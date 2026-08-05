#!/usr/bin/env node
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadWorkflowSpec } from "./research-reducer.mjs";
import {
  createReplayEntry,
  sha256File,
  verifyRun,
} from "./run-integrity.mjs";

let failed = 0;

function assert(name, condition, detail = "") {
  if (!condition) {
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
    failed += 1;
  } else {
    console.log(`OK ${name}`);
  }
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function createRun(runDir) {
  mkdirSync(join(runDir, "artifacts"), { recursive: true });
  mkdirSync(join(runDir, "snapshots"), { recursive: true });
  writeJson(join(runDir, "run-meta.json"), {
    runId: "2026-08-05-integrity-test-abc12",
    workflowId: "deep-research",
    startedAt: "2026-08-05T08:00:00.000Z",
    slug: "integrity-test",
  });
  writeJson(join(runDir, "state.json"), {
    runId: "2026-08-05-integrity-test-abc12",
    workflowId: "deep-research",
    currentState: "explore",
    barrier: { expected: 0, completed: 0, pendingSubagents: [] },
    history: [],
    aborted: false,
  });
  const pack = {
    schemaVersion: 1,
    metadata: {
      pipeline_id: "deep-research",
      phase_id: "explore",
      context_pack_version: 2,
      run_id: "2026-08-05-integrity-test-abc12",
      slug: "integrity-test",
    },
    L0_constraints: { researchType: "selection_compare", scope: "test" },
    L1_session_anchor: { currentState: "explore", phaseGoal: "explore" },
  };
  writeJson(join(runDir, "context-pack.json"), pack);
  writeJson(join(runDir, "snapshots", "context-pack@v2.json"), pack);
  writeJson(join(runDir, "artifacts", "research-brief.json"), {
    reader: "developer",
    scope: "test",
    evidenceTargets: [{ targetId: "runtime", repoPath: "." }],
  });
  writeFileSync(join(runDir, "observations.jsonl"), "", "utf8");
  const entry = createReplayEntry({
    runDir,
    phase: "brief",
    nextPhase: "explore",
    workflowId: "deep-research",
    schemaVersion: 1,
    contextPackSnapshot: "snapshots/context-pack@v2.json",
    artifacts: ["artifacts/research-brief.json"],
    gate: "brief-complete",
    gateResult: "pass",
  });
  writeJson(join(runDir, "replay-chain.json"), { entries: [{ seq: 1, ...entry }] });
}

function main() {
  const runDir = mkdtempSync(join(tmpdir(), "run-integrity-"));
  const spec = loadWorkflowSpec();
  try {
    createRun(runDir);
    const valid = verifyRun(runDir, spec);
    assert("valid run passes integrity verification", valid.ok, valid.errors.join("; "));
    assert(
      "sha256 uses prefixed digest",
      /^sha256:[a-f0-9]{64}$/.test(
        sha256File(join(runDir, "artifacts", "research-brief.json")),
      ),
    );

    const artifactPath = join(runDir, "artifacts", "research-brief.json");
    const originalArtifact = readFileSync(artifactPath, "utf8");
    writeFileSync(artifactPath, "tampered", "utf8");
    const tampered = verifyRun(runDir, spec);
    assert(
      "artifact hash drift is detected",
      !tampered.ok && tampered.errors.some((error) => error.includes("sha256 mismatch")),
      tampered.errors.join("; "),
    );
    writeFileSync(artifactPath, originalArtifact, "utf8");

    const replayPath = join(runDir, "replay-chain.json");
    const replay = readJson(replayPath);
    replay.entries.push({ ...replay.entries[0], seq: 3 });
    writeJson(replayPath, replay);
    const brokenSeq = verifyRun(runDir, spec);
    assert(
      "non-contiguous replay sequence is rejected",
      !brokenSeq.ok && brokenSeq.errors.some((error) => error.includes("sequence")),
      brokenSeq.errors.join("; "),
    );

    replay.entries = [{ ...replay.entries[0], seq: 1, gate: "wrong-gate" }];
    writeJson(replayPath, replay);
    const wrongGate = verifyRun(runDir, spec);
    assert(
      "replay gate must match phase",
      !wrongGate.ok && wrongGate.errors.some((error) => error.includes("does not match phase")),
      wrongGate.errors.join("; "),
    );

    replay.entries = [
      {
        ...replay.entries[0],
        seq: 1,
        contextPackSnapshot: "../outside.json",
      },
    ];
    writeJson(replayPath, replay);
    const escaped = verifyRun(runDir, spec);
    assert(
      "replay path escape is rejected",
      !escaped.ok && escaped.errors.some((error) => error.includes("escapes run directory")),
      escaped.errors.join("; "),
    );

    const outsidePath = join(dirname(runDir), `${Date.now()}-outside.json`);
    const linkPath = join(runDir, "linked-outside.json");
    writeFileSync(outsidePath, "outside", "utf8");
    try {
      symlinkSync(outsidePath, linkPath, "file");
      replay.entries = [
        {
          ...replay.entries[0],
          seq: 1,
          contextPackSnapshot: "linked-outside.json",
          contextPackSha256: sha256File(outsidePath),
        },
      ];
      writeJson(replayPath, replay);
      const symlinkEscape = verifyRun(runDir, spec);
      assert(
        "symlink escape is rejected",
        !symlinkEscape.ok &&
          symlinkEscape.errors.some((error) => error.includes("escapes run directory")),
        symlinkEscape.errors.join("; "),
      );
    } catch (error) {
      if (error.code === "EPERM") {
        console.log("SKIP symlink escape test (insufficient OS permission)");
      } else {
        throw error;
      }
    } finally {
      rmSync(outsidePath, { force: true });
    }
  } finally {
    if (existsSync(runDir)) rmSync(runDir, { recursive: true, force: true });
  }

  if (failed > 0) {
    console.error(`\n${failed} integrity test(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll integrity tests passed.");
}

main();
