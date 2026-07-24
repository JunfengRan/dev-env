#!/usr/bin/env node
import { loadWorkflowSpec, createInitialRunState, reduce } from "./research-reducer.mjs";

let failed = 0;

function assert(name, condition, detail = "") {
  if (!condition) {
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
    failed += 1;
  } else {
    console.log(`OK ${name}`);
  }
}

const spec = loadWorkflowSpec();
let runState = createInitialRunState(spec, "test-run");

assert("initial state is brief", runState.currentState === "brief");

let result = reduce(runState, { type: "GATE_PASSED", gate: "brief-complete" }, spec);
runState = result.runState;
assert("gate pass moves to explore", runState.currentState === "explore", runState.currentState);

result = reduce(runState, { type: "GATE_FAILED", gate: "explore-min-depth", reason: "too short" }, spec);
runState = result.runState;
assert("gate fail loops explore", runState.currentState === "explore", runState.currentState);

result = reduce(runState, { type: "GATE_PASSED", gate: "explore-min-depth" }, spec);
runState = result.runState;
assert("explore pass moves to verify", runState.currentState === "verify", runState.currentState);

result = reduce(runState, {
  type: "PHASE_ENTER",
  state: "verify",
  evidenceTargets: [{ targetId: "t1" }, { targetId: "t2" }],
}, spec);
runState = result.runState;
assert("verify sets barrier expected=2", runState.barrier.expected === 2);

result = reduce(runState, { type: "SUBAGENT_COMPLETED", subagentId: "t1", artifact: "artifacts/evidence/t1.json" }, spec);
runState = result.runState;
assert("first subagent increments completed", runState.barrier.completed === 1);

result = reduce(runState, { type: "SUBAGENT_COMPLETED", subagentId: "t2", artifact: "artifacts/evidence/t2.json" }, spec);
runState = result.runState;
assert("barrier complete after all subagents", runState.barrier.completed === 2 && runState.barrier.pendingSubagents.length === 0);

result = reduce(runState, { type: "GATE_PASSED", gate: "evidence-table-valid" }, spec);
runState = result.runState;
assert("verify pass moves to consolidate", runState.currentState === "consolidate", runState.currentState);

result = reduce(runState, { type: "USER_ABORT" }, spec);
runState = result.runState;
assert("abort moves to aborted", runState.currentState === "aborted" && runState.aborted === true);

if (failed > 0) {
  console.error(`\n${failed} reducer test(s) failed.`);
  process.exit(1);
}

console.log("\nAll reducer tests passed.");
