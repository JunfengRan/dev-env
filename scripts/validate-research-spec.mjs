#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";
import { createInitialRunState, loadWorkflowSpec, reduce } from "./research-reducer.mjs";
import { verifyRun } from "./run-integrity.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validateSchema(instance, schemaPath, label) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = readJson(schemaPath);
  const validate = ajv.compile(schema);
  const ok = validate(instance);
  if (!ok) {
    console.error(`${label} schema validation failed:`);
    for (const err of validate.errors ?? []) {
      console.error(`  - ${err.instancePath || "/"} ${err.message}`);
    }
    process.exit(1);
  }
}

function main() {
  const specPath = join(ROOT, "spec", "research-workflow.yaml");
  const spec = YAML.parse(readFileSync(specPath, "utf8"));

  validateSchema(spec, join(ROOT, "spec", "research-workflow.schema.json"), "research-workflow.yaml");

  if (!spec.states[spec.initialState]) {
    console.error(`initialState "${spec.initialState}" not found in states`);
    process.exit(1);
  }

  for (const [name, state] of Object.entries(spec.states)) {
    if (state.kind === "terminal") continue;
    if (!state.gate) {
      console.error(`state "${name}" missing gate`);
      process.exit(1);
    }
    if (!spec.gates[state.gate]) {
      console.error(`state "${name}" references unknown gate "${state.gate}"`);
      process.exit(1);
    }
    const scriptRel = spec.gates[state.gate].script;
    const scriptPath = join(ROOT, scriptRel);
    if (!existsSync(scriptPath)) {
      console.error(`gate script missing for "${state.gate}": ${scriptRel}`);
      process.exit(1);
    }
    if (state.onPass && !spec.states[state.onPass]) {
      console.error(`state "${name}" onPass "${state.onPass}" unknown`);
      process.exit(1);
    }
    if (state.onFail && !spec.states[state.onFail]) {
      console.error(`state "${name}" onFail "${state.onFail}" unknown`);
      process.exit(1);
    }
  }

  const samplePack = {
    schemaVersion: 1,
    metadata: {
      pipeline_id: "deep-research",
      phase_id: "brief",
      context_pack_version: 1,
      run_id: "sample",
      slug: "sample",
    },
    L0_constraints: {
      researchType: "selection_compare",
      scope: "sample scope",
    },
    L1_session_anchor: {
      currentState: "brief",
      phaseGoal: "write research brief",
    },
  };
  validateSchema(samplePack, join(ROOT, "spec", "context-pack.schema.json"), "context-pack");

  const sampleObservation = {
    ts: "2026-07-24T06:00:00Z",
    actor: { type: "subagent", id: "verifier-1", agent: "codebase-verifier" },
    phase: "verify",
    kind: "evidence_row",
    payload: { claim: "test", verdict: "true", filePath: "src/a.ts" },
    contextPackVersion: 1,
  };
  validateSchema(sampleObservation, join(ROOT, "spec", "observation.schema.json"), "observation");

  const sampleRunDir = join(ROOT, "docs", "examples", "sample-research-run");
  const sampleRunResult = verifyRun(sampleRunDir, spec);
  if (!sampleRunResult.ok) {
    console.error("sample research run validation failed:");
    for (const error of sampleRunResult.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const run = createInitialRunState(loadWorkflowSpec());
  const afterPass = reduce(run, { type: "GATE_PASSED", gate: "brief-complete" }, spec);
  if (afterPass.error) {
    console.error(`reducer smoke failed: ${afterPass.error}`);
    process.exit(1);
  }

  console.log("Research spec validation passed.");
}

main();
