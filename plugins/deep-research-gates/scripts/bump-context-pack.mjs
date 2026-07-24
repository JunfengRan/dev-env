#!/usr/bin/env node
/**
 * Bump context-pack version and write snapshot
 * Usage: node bump-context-pack.mjs <run-dir> [phaseId]
 */
import { appendFileSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const [runDir, phaseId] = process.argv.slice(2);
if (!runDir) {
  console.error("usage: bump-context-pack.mjs <run-dir> [phaseId]");
  process.exit(1);
}

const packPath = join(runDir, "context-pack.json");
if (!existsSync(packPath)) {
  console.error("context-pack.json not found");
  process.exit(1);
}

const pack = JSON.parse(readFileSync(packPath, "utf8"));
pack.metadata = pack.metadata ?? {};
pack.metadata.context_pack_version = (pack.metadata.context_pack_version ?? 0) + 1;
if (phaseId) {
  pack.metadata.phase_id = phaseId;
  pack.L1_session_anchor = pack.L1_session_anchor ?? {};
  pack.L1_session_anchor.currentState = phaseId;
}

const version = pack.metadata.context_pack_version;
const snapDir = join(runDir, "snapshots");
mkdirSync(snapDir, { recursive: true });
const snapPath = join(runDir, "snapshots", `context-pack@v${version}.json`);
writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
writeFileSync(snapPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");

const obsPath = join(runDir, "observations.jsonl");
const observation = {
  ts: new Date().toISOString(),
  actor: { type: "system", id: "context-pack-bump" },
  phase: phaseId ?? pack.L1_session_anchor?.currentState ?? "unknown",
  kind: "context_pack_bump",
  payload: { version, snapshot: snapPath },
  contextPackVersion: version,
};
appendFileSync(obsPath, `${JSON.stringify(observation)}\n`, "utf8");

console.log(`context-pack bumped to v${version}`);
