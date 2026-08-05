#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, "..");
const CLI = join(SCRIPT_DIR, "research-cli.mjs");
const SAMPLE_RUN = join(ROOT, "docs", "examples", "sample-research-run");

let failed = 0;

function assert(name, condition, detail = "") {
  if (!condition) {
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
    failed += 1;
  } else {
    console.log(`OK ${name}`);
  }
}

function runCli(args, opts = {}) {
  return execFileSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

function cliFails(args) {
  try {
    runCli(args);
    return false;
  } catch {
    return true;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main() {
  const researchRoot = join(ROOT, ".research");
  const testHash = Date.now().toString(36).slice(-8).padStart(5, "0");
  const runId = `2026-08-05-cli-test-${testHash}`;
  const runDir = join(researchRoot, runId);
  const invalidRunId = "invalid/run-id";
  const invalidRunDir = join(researchRoot, invalidRunId);
  const missingSlugRunId = `2026-08-05-missing-slug-${testHash}`;
  const missingSlugRunDir = join(researchRoot, missingSlugRunId);

  try {
    assert("init rejects invalid run id", cliFails(["init", invalidRunId]));
    assert(
      "init rejects missing slug value",
      cliFails(["init", missingSlugRunId, "--slug"]),
    );
    assert("status rejects missing run-id value", cliFails(["status", "--run-id"]));

    runCli(["init", runId, "--slug", "cli-test"]);
    assert("init creates state.json", existsSync(join(runDir, "state.json")));
    const state = readJson(join(runDir, "state.json"));
    assert("init currentState is brief", state.currentState === "brief");

    const statusOut = runCli(["status", runDir]);
    const status = JSON.parse(statusOut);
    assert("status reports brief", status.currentState === "brief");

    assert(
      "apply rejects direct gate transition events",
      cliFails([
        "apply",
        runDir,
        JSON.stringify({ type: "GATE_PASSED", gate: "brief-complete" }),
      ]),
    );
    assert(
      "rejected direct gate event keeps current state",
      readJson(join(runDir, "state.json")).currentState === "brief",
    );

    // advance without artifacts should fail and write gateLastResult
    let failedAdvance = false;
    try {
      runCli(["advance", runDir]);
    } catch (err) {
      failedAdvance = true;
      const pack = readJson(join(runDir, "context-pack.json"));
      assert(
        "advance fail writes gateLastResult.fail",
        pack.L1_session_anchor?.gateLastResult?.result === "fail",
        JSON.stringify(pack.L1_session_anchor?.gateLastResult),
      );
      assert(
        "advance fail stays on brief",
        readJson(join(runDir, "state.json")).currentState === "brief",
      );
    }
    assert("advance without brief artifact fails", failedAdvance);

    // copy brief artifact from sample and advance successfully
    mkdirSync(join(runDir, "artifacts"), { recursive: true });
    cpSync(
      join(SAMPLE_RUN, "artifacts", "research-brief.json"),
      join(runDir, "artifacts", "research-brief.json"),
    );
    const passOut = runCli(["advance", runDir]);
    const passLine = passOut
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("{") && l.includes('"ok"'))
      .at(-1);
    const pass = JSON.parse(passLine);
    assert("advance pass moves to explore", pass.to === "explore", JSON.stringify(pass));
    assert(
      "state.json advanced to explore",
      readJson(join(runDir, "state.json")).currentState === "explore",
    );
    const packAfter = readJson(join(runDir, "context-pack.json"));
    assert(
      "gateLastResult pass after success",
      packAfter.L1_session_anchor?.gateLastResult?.result === "pass",
    );
    assert(
      "context pack bumped",
      (packAfter.metadata?.context_pack_version ?? 0) >= 2,
    );
    const replay = readJson(join(runDir, "replay-chain.json"));
    assert("replay-chain has entry", (replay.entries?.length ?? 0) >= 1);
    const verifyOut = JSON.parse(runCli(["verify", runDir]));
    assert("verify command accepts intact run", verifyOut.ok === true);
    const briefPath = join(runDir, "artifacts", "research-brief.json");
    const originalBrief = readFileSync(briefPath, "utf8");
    writeFileSync(briefPath, "tampered", "utf8");
    assert("verify command rejects artifact drift", cliFails(["verify", runDir]));
    writeFileSync(briefPath, originalBrief, "utf8");

    // apply SUBAGENT_COMPLETED via CLI on a verify-like barrier state
    const verifyDir = mkdtempSync(join(tmpdir(), "research-cli-verify-"));
    writeFileSync(
      join(verifyDir, "state.json"),
      `${JSON.stringify(
        {
          runId: "verify-test",
          workflowId: "deep-research",
          currentState: "verify",
          barrier: { expected: 2, completed: 0, pendingSubagents: ["t1", "t2"] },
          history: [],
          aborted: false,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(verifyDir, "context-pack.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          metadata: {
            pipeline_id: "deep-research",
            phase_id: "verify",
            context_pack_version: 1,
            run_id: "verify-test",
            slug: "verify-test",
          },
          L0_constraints: { researchType: "selection_compare", scope: "t" },
          L1_session_anchor: { currentState: "verify", phaseGoal: "verify" },
        },
        null,
        2,
      )}\n`,
    );
    runCli([
      "apply",
      verifyDir,
      JSON.stringify({ type: "SUBAGENT_COMPLETED", subagentId: "t1" }),
    ]);
    const afterApply = readJson(join(verifyDir, "state.json"));
    assert("apply SUBAGENT_COMPLETED increments barrier", afterApply.barrier.completed === 1);
    assert(
      "apply removes pending subagent",
      !afterApply.barrier.pendingSubagents.includes("t1"),
    );
    rmSync(verifyDir, { recursive: true, force: true });
  } finally {
    if (existsSync(runDir)) rmSync(runDir, { recursive: true, force: true });
    if (existsSync(invalidRunDir)) rmSync(invalidRunDir, { recursive: true, force: true });
    if (existsSync(missingSlugRunDir)) {
      rmSync(missingSlugRunDir, { recursive: true, force: true });
    }
  }

  // dedicated after-subagent test
  const barrierDir = mkdtempSync(join(tmpdir(), "after-sub-"));
  try {
    writeFileSync(
      join(barrierDir, "state.json"),
      `${JSON.stringify(
        {
          runId: "after-sub",
          workflowId: "deep-research",
          currentState: "verify",
          barrier: { expected: 1, completed: 0, pendingSubagents: ["runtime-core"] },
          history: [],
          aborted: false,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(barrierDir, "context-pack.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          metadata: {
            pipeline_id: "deep-research",
            phase_id: "verify",
            context_pack_version: 1,
            run_id: "after-sub",
            slug: "after-sub",
          },
          L0_constraints: { researchType: "selection_compare", scope: "t" },
          L1_session_anchor: { currentState: "verify", phaseGoal: "verify" },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(join(barrierDir, "observations.jsonl"), "");
    execFileSync(
      process.execPath,
      [
        join(ROOT, "plugins", "deep-research-gates", "scripts", "after-subagent-complete.mjs"),
        barrierDir,
        "runtime-core",
        "artifacts/evidence/runtime-core.json",
      ],
      { cwd: ROOT, encoding: "utf8", stdio: "pipe" },
    );
    const st = readJson(join(barrierDir, "state.json"));
    assert("after-subagent uses reducer barrier", st.barrier.completed === 1);
    assert("after-subagent clears pending", st.barrier.pendingSubagents.length === 0);
  } finally {
    rmSync(barrierDir, { recursive: true, force: true });
  }

  if (failed > 0) {
    console.error(`\n${failed} research-cli test(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll research-cli tests passed.");
}

main();
