#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, "..");
const SAMPLE_RUN = join(ROOT, "docs", "examples", "sample-research-run");
const TEMP_RUN = join(ROOT, ".tmp-gate-test-run");

function runGate(gate, runDir) {
  execSync(`node scripts/gates/${gate}.mjs "${runDir}"`, {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf8",
  });
}

function runGateExpectFail(gate, runDir) {
  try {
    runGate(gate, runDir);
    return false;
  } catch {
    return true;
  }
}

function setupTempRun() {
  if (existsSync(TEMP_RUN)) rmSync(TEMP_RUN, { recursive: true, force: true });
  cpSync(SAMPLE_RUN, TEMP_RUN, { recursive: true });
}

function main() {
  if (!existsSync(SAMPLE_RUN)) {
    console.error("sample-research-run not found; run docs setup first");
    process.exit(1);
  }

  setupTempRun();
  let failed = 0;

  const gates = [
    "brief-complete",
    "explore-min-depth",
    "evidence-table-valid",
    "knowledge-note-depth",
    "catalog-numbered",
    "decision-doc-complete",
    "optional",
  ];

  for (const gate of gates) {
    try {
      runGate(gate, SAMPLE_RUN);
      console.log(`OK gate ${gate} on sample run`);
    } catch (err) {
      console.error(`FAIL gate ${gate} on sample run: ${err.stderr ?? err.message}`);
      failed += 1;
    }
  }

  writeFileSync(join(TEMP_RUN, "artifacts", "research-brief.json"), "{}");
  if (!runGateExpectFail("brief-complete", TEMP_RUN)) {
    console.error("FAIL brief-complete should fail on empty brief");
    failed += 1;
  } else {
    console.log("OK brief-complete fails on invalid brief");
  }

  setupTempRun();
  try {
    const statePath = join(TEMP_RUN, "state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    state.currentState = "verify";
    state.barrier = {
      expected: 1,
      completed: 0,
      pendingSubagents: ["runtime-core"],
    };
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    execSync(
      `node plugins/deep-research-gates/scripts/after-subagent-complete.mjs "${TEMP_RUN}" runtime-core artifacts/evidence/runtime-core.json`,
      { cwd: ROOT, stdio: "pipe", encoding: "utf8" },
    );
    const after = JSON.parse(readFileSync(statePath, "utf8"));
    if (after.barrier.completed !== 1 || after.barrier.pendingSubagents.includes("runtime-core")) {
      throw new Error(`unexpected barrier: ${JSON.stringify(after.barrier)}`);
    }
    console.log("OK after-subagent-complete merges observation");
  } catch (err) {
    console.error(`FAIL after-subagent-complete: ${err.stderr ?? err.message}`);
    failed += 1;
  }

  rmSync(TEMP_RUN, { recursive: true, force: true });

  if (failed > 0) {
    console.error(`\n${failed} gate test(s) failed.`);
    process.exit(1);
  }

  console.log("\nAll gate tests passed.");
}

main();
