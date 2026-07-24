#!/usr/bin/env node
/**
 * Merge subagent result into observations.jsonl and update barrier via reducer.
 * Usage: node after-subagent-complete.mjs <run-dir> <subagentId> <artifactPath>
 */
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [runDirArg, subagentId, artifactPath] = process.argv.slice(2);
if (!runDirArg || !subagentId) {
  console.error("usage: after-subagent-complete.mjs <run-dir> <subagentId> [artifactPath]");
  process.exit(1);
}

const runDir = resolve(runDirArg);
const obsPath = join(runDir, "observations.jsonl");
const statePath = join(runDir, "state.json");
const packPath = join(runDir, "context-pack.json");

const pack = existsSync(packPath)
  ? JSON.parse(readFileSync(packPath, "utf8"))
  : { metadata: { context_pack_version: 1 } };
const version = pack.metadata?.context_pack_version ?? 1;
const phase = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8")).currentState
  : "verify";

const observation = {
  ts: new Date().toISOString(),
  actor: { type: "subagent", id: subagentId, agent: "codebase-verifier" },
  phase,
  kind: "subagent_status",
  payload: { status: "completed", artifact: artifactPath ?? null },
  contextPackVersion: version,
};

appendFileSync(obsPath, `${JSON.stringify(observation)}\n`, "utf8");

if (!existsSync(statePath)) {
  console.log(`observation appended for subagent ${subagentId} (no state.json)`);
  process.exit(0);
}

const reducerUrl = pathToFileURL(resolve(process.cwd(), "scripts", "research-reducer.mjs")).href;
const { loadWorkflowSpec, reduce } = await import(reducerUrl);
const spec = loadWorkflowSpec();
const runState = JSON.parse(readFileSync(statePath, "utf8"));
const result = reduce(
  runState,
  { type: "SUBAGENT_COMPLETED", subagentId, artifact: artifactPath ?? null },
  spec,
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

writeFileSync(statePath, `${JSON.stringify(result.runState, null, 2)}\n`, "utf8");
console.log(`observation appended for subagent ${subagentId}; barrier.completed=${result.runState.barrier.completed}`);
