#!/usr/bin/env node
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { atomicWriteJson, withRunLock } from "./run-persistence.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, "..");
const AFTER_SUBAGENT = join(
  ROOT,
  "plugins",
  "deep-research-gates",
  "scripts",
  "after-subagent-complete.mjs",
);
const BUMP_CONTEXT = join(
  ROOT,
  "plugins",
  "deep-research-gates",
  "scripts",
  "bump-context-pack.mjs",
);

let failed = 0;

function assert(name, condition, detail = "") {
  if (!condition) {
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
    failed += 1;
  } else {
    console.log(`OK ${name}`);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function runProcess(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("exit", (code) => resolve({ code, stderr }));
  });
}

function writeRun(runDir) {
  atomicWriteJson(join(runDir, "state.json"), {
    runId: "concurrent-test",
    workflowId: "deep-research",
    currentState: "verify",
    barrier: { expected: 2, completed: 0, pendingSubagents: ["t1", "t2"] },
    history: [],
    aborted: false,
  });
  atomicWriteJson(join(runDir, "context-pack.json"), {
    schemaVersion: 1,
    metadata: {
      pipeline_id: "deep-research",
      phase_id: "verify",
      context_pack_version: 1,
      run_id: "concurrent-test",
      slug: "concurrent-test",
    },
    L0_constraints: { researchType: "selection_compare", scope: "test" },
    L1_session_anchor: { currentState: "verify", phaseGoal: "verify" },
  });
  writeFileSync(join(runDir, "observations.jsonl"), "", "utf8");
}

async function main() {
  const root = mkdtempSync(join(tmpdir(), "run-persistence-"));
  const atomicPath = join(root, "atomic.json");
  try {
    atomicWriteJson(atomicPath, { ok: true });
    assert("atomic write produces valid JSON", readJson(atomicPath).ok === true);
    assert(
      "atomic write leaves no temporary files",
      !readdirSync(root).some((name) => name.includes(".tmp-")),
    );

    let lockTimedOut = false;
    await withRunLock(root, async () => {
      try {
        await withRunLock(root, async () => {}, { timeoutMs: 50, retryMs: 5 });
      } catch (error) {
        lockTimedOut = error.message.includes("Timed out");
      }
    });
    assert("competing lock acquisition times out", lockTimedOut);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      writeRun(root);
      const [first, second] = await Promise.all([
        runProcess([AFTER_SUBAGENT, root, "t1", "artifacts/evidence/t1.json"]),
        runProcess([AFTER_SUBAGENT, root, "t2", "artifacts/evidence/t2.json"]),
      ]);
      assert(
        `concurrent subagents exit successfully (${attempt + 1})`,
        first.code === 0 && second.code === 0,
        `${first.stderr} ${second.stderr}`.trim(),
      );
      const state = readJson(join(root, "state.json"));
      const observations = readFileSync(join(root, "observations.jsonl"), "utf8")
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);
      assert(
        `concurrent subagents preserve both updates (${attempt + 1})`,
        state.barrier.completed === 2 &&
          state.barrier.pendingSubagents.length === 0 &&
          observations.length === 2,
        JSON.stringify({ barrier: state.barrier, observations: observations.length }),
      );
    }

    const [firstBump, secondBump] = await Promise.all([
      runProcess([BUMP_CONTEXT, root, "verify"]),
      runProcess([BUMP_CONTEXT, root, "verify"]),
    ]);
    const bumpedPack = readJson(join(root, "context-pack.json"));
    assert(
      "concurrent context bumps exit successfully",
      firstBump.code === 0 && secondBump.code === 0,
      `${firstBump.stderr} ${secondBump.stderr}`.trim(),
    );
    assert(
      "concurrent context bumps preserve both versions",
      bumpedPack.metadata.context_pack_version === 3 &&
        existsSync(join(root, "snapshots", "context-pack@v2.json")) &&
        existsSync(join(root, "snapshots", "context-pack@v3.json")),
      JSON.stringify(bumpedPack.metadata),
    );
  } finally {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  }

  if (failed > 0) {
    console.error(`\n${failed} persistence test(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll persistence tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
