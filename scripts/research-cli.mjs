#!/usr/bin/env node
/**
 * Disk adapter for deep-research reducer.
 * Usage:
 *   node scripts/research-cli.mjs init <run-id> [--slug <slug>]
 *   node scripts/research-cli.mjs status [run-dir]
 *   node scripts/research-cli.mjs apply <run-dir> <event.json|->
 *   node scripts/research-cli.mjs advance [run-dir]
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createInitialRunState, loadWorkflowSpec, reduce } from "./research-reducer.mjs";
import {
  appendJsonLine,
  atomicWriteJson,
  withRunLock,
} from "./run-persistence.mjs";
import { createReplayEntry, verifyRun } from "./run-integrity.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, "..");
const RESEARCH_DIR = join(ROOT, ".research");
const BUMP_SCRIPT = join(ROOT, "plugins", "deep-research-gates", "scripts", "bump-context-pack.mjs");
const RUN_ID_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])-[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{5,12}$/;

function usage(exitCode = 1) {
  console.error(`usage:
  node scripts/research-cli.mjs init <run-id> [--slug <slug>]
  node scripts/research-cli.mjs status [run-dir]
  node scripts/research-cli.mjs apply <run-dir> <event.json|->
  node scripts/research-cli.mjs advance [run-dir]
  node scripts/research-cli.mjs verify [run-dir]

Active run resolution: --run-id / RESEARCH_RUN_ID, else newest non-terminal .research/*/state.json`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--slug" || a === "--run-id") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`${a} requires a value`);
      }
      flags[a.slice(2)] = value;
      i += 1;
    } else if (a === "--help" || a === "-h") {
      flags.help = true;
    } else {
      args.push(a);
    }
  }
  return { args, flags };
}

function validateRunId(runId) {
  if (typeof runId !== "string" || !RUN_ID_PATTERN.test(runId)) {
    throw new Error(
      `invalid run id "${runId ?? ""}"; expected YYYY-MM-DD-slug-shortHash`,
    );
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  atomicWriteJson(path, value);
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function resolveRunDir(explicit, flags = {}) {
  if (explicit) {
    const path = resolve(explicit);
    if (!existsSync(join(path, "state.json"))) {
      throw new Error(`run dir missing state.json: ${path}`);
    }
    return path;
  }

  const runId = flags["run-id"] || process.env.RESEARCH_RUN_ID;
  if (runId) {
    validateRunId(runId);
    const path = join(RESEARCH_DIR, runId);
    if (!existsSync(join(path, "state.json"))) {
      throw new Error(`RESEARCH_RUN_ID/run-id not found: ${path}`);
    }
    return path;
  }

  if (!existsSync(RESEARCH_DIR)) {
    throw new Error(".research/ not found");
  }

  const candidates = readdirSync(RESEARCH_DIR)
    .map((name) => join(RESEARCH_DIR, name))
    .filter((p) => existsSync(join(p, "state.json")))
    .map((p) => {
      const state = readJson(join(p, "state.json"));
      return { path: p, state, mtimeMs: statSync(join(p, "state.json")).mtimeMs };
    })
    .filter((c) => c.state.currentState !== "done" && c.state.currentState !== "aborted")
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (candidates.length === 0) {
    throw new Error("no active research run found under .research/");
  }
  return candidates[0].path;
}

function minimalContextPack({ runId, slug, currentState, phaseGoal }) {
  return {
    schemaVersion: 1,
    metadata: {
      pipeline_id: "deep-research",
      phase_id: currentState,
      context_pack_version: 1,
      run_id: runId,
      slug: slug ?? runId,
    },
    L0_constraints: {
      researchType: "selection_compare",
      scope: "TBD",
      forbiddenPaths: [],
    },
    L1_session_anchor: {
      currentState,
      phaseGoal: phaseGoal ?? `Execute phase ${currentState}`,
      gateLastResult: {
        gate: "pending",
        result: "pending",
        reason: "run initialized",
      },
    },
  };
}

function writeGateLastResult(runDir, gateLastResult) {
  const packPath = join(runDir, "context-pack.json");
  const pack = existsSync(packPath)
    ? readJson(packPath)
    : minimalContextPack({
        runId: readJson(join(runDir, "state.json")).runId,
        currentState: readJson(join(runDir, "state.json")).currentState,
      });
  pack.L1_session_anchor = pack.L1_session_anchor ?? {};
  pack.L1_session_anchor.currentState =
    pack.L1_session_anchor.currentState ?? readJson(join(runDir, "state.json")).currentState;
  pack.L1_session_anchor.phaseGoal =
    pack.L1_session_anchor.phaseGoal ?? `Execute phase ${pack.L1_session_anchor.currentState}`;
  pack.L1_session_anchor.gateLastResult = gateLastResult;
  writeJson(packPath, pack);
  return pack;
}

function appendReplayEntry(runDir, entry) {
  const path = join(runDir, "replay-chain.json");
  const chain = existsSync(path) ? readJson(path) : { entries: [] };
  chain.entries = chain.entries ?? [];
  const seq = (chain.entries[chain.entries.length - 1]?.seq ?? 0) + 1;
  chain.entries.push({ seq, ...entry });
  writeJson(path, chain);
}

function replayArtifacts(runDir, stateDef) {
  const declared = [
    ...(stateDef.outputs ?? []),
    ...(stateDef.spawn ?? []).flatMap((spawn) => spawn.outputs ?? []),
  ];
  const artifacts = [];
  for (const output of declared) {
    if (typeof output !== "string" || !output.startsWith("artifacts/")) continue;
    if (output.endsWith("/*.json")) {
      const directory = output.slice(0, -"/*.json".length);
      const absoluteDirectory = join(runDir, directory);
      if (!existsSync(absoluteDirectory)) continue;
      for (const name of readdirSync(absoluteDirectory).filter((file) =>
        file.endsWith(".json"),
      )) {
        artifacts.push(`${directory}/${name}`);
      }
    } else if (!output.includes("{") && existsSync(join(runDir, output))) {
      artifacts.push(output);
    }
  }
  return [...new Set(artifacts)].sort();
}

function appendObservation(runDir, observation) {
  const path = join(runDir, "observations.jsonl");
  appendJsonLine(path, observation);
}

function cmdInit(runId, flags) {
  if (!runId) usage();
  validateRunId(runId);
  const runDir = join(RESEARCH_DIR, runId);
  if (existsSync(join(runDir, "state.json"))) {
    console.error(`run already exists: ${runDir}`);
    process.exit(1);
  }

  const spec = loadWorkflowSpec();
  const state = createInitialRunState(spec, runId);
  const slug = flags.slug ?? (runId.split("-").slice(3).join("-") || runId);

  ensureDir(join(runDir, "artifacts"));
  ensureDir(join(runDir, "snapshots"));
  writeJson(join(runDir, "run-meta.json"), {
    runId,
    workflowId: spec.workflowId,
    startedAt: new Date().toISOString(),
    slug,
  });
  writeJson(join(runDir, "state.json"), state);
  writeJson(
    join(runDir, "context-pack.json"),
    minimalContextPack({
      runId,
      slug,
      currentState: state.currentState,
      phaseGoal: "Produce research brief",
    }),
  );
  writeFileSync(join(runDir, "observations.jsonl"), "", "utf8");
  writeJson(join(runDir, "replay-chain.json"), { entries: [] });

  console.log(`initialized ${runDir}`);
  console.log(`currentState=${state.currentState}`);
}

function cmdStatus(runDirArg, flags) {
  const runDir = resolveRunDir(runDirArg, flags);
  const state = readJson(join(runDir, "state.json"));
  const packPath = join(runDir, "context-pack.json");
  const gate = existsSync(packPath) ? readJson(packPath).L1_session_anchor?.gateLastResult : null;
  const recent = (state.history ?? []).slice(-3);

  console.log(
    JSON.stringify(
      {
        runDir,
        runId: state.runId,
        currentState: state.currentState,
        aborted: state.aborted ?? false,
        barrier: state.barrier,
        gateLastResult: gate ?? null,
        recentHistory: recent,
      },
      null,
      2,
    ),
  );
}

function applyEvent(runDir, event) {
  const spec = loadWorkflowSpec();
  const statePath = join(runDir, "state.json");
  const runState = readJson(statePath);
  const result = reduce(runState, event, spec);
  if (result.error) {
    throw new Error(result.error);
  }
  writeJson(statePath, result.runState);
  return result;
}

async function cmdApply(runDirArg, eventArg, flags) {
  if (!runDirArg || eventArg === undefined) usage();
  const runDir = resolveRunDir(runDirArg, flags);
  let raw = eventArg;
  if (eventArg === "-") {
    raw = readFileSync(0, "utf8");
  }
  const event = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (event?.type === "GATE_PASSED" || event?.type === "GATE_FAILED") {
    throw new Error(
      `${event.type} cannot be applied directly; use research-cli advance`,
    );
  }
  const result = await withRunLock(runDir, async () => applyEvent(runDir, event));
  console.log(
    JSON.stringify(
      {
        ok: true,
        currentState: result.runState.currentState,
        barrier: result.runState.barrier,
        barrierComplete: result.barrierComplete ?? null,
      },
      null,
      2,
    ),
  );
}

function runGateScript(gate, runDir) {
  const gateScript = join(ROOT, "scripts", "gates", `${gate}.mjs`);
  if (!existsSync(gateScript)) {
    throw new Error(`gate script not found: ${gateScript}`);
  }
  try {
    execFileSync(process.execPath, [gateScript, runDir], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, reason: "pass" };
  } catch (err) {
    const stderr = err.stderr?.toString?.() ?? err.message ?? "gate failed";
    return { ok: false, reason: stderr.trim() };
  }
}

async function cmdAdvance(runDirArg, flags) {
  const runDir = resolveRunDir(runDirArg, flags);
  return withRunLock(runDir, async () => {
    const spec = loadWorkflowSpec();
    const state = readJson(join(runDir, "state.json"));
    const stateName = state.currentState;
    const stateDef = spec.states[stateName];

    if (!stateDef || stateDef.kind === "terminal") {
      throw new Error(`cannot advance from terminal/unknown state: ${stateName}`);
    }

    const gate = stateDef.gate;
    if (!gate) {
      throw new Error(`state ${stateName} has no gate`);
    }

    if (gate === "optional") {
      const result = applyEvent(runDir, { type: "GATE_PASSED", gate });
      writeGateLastResult(runDir, { gate, result: "pass", reason: "optional gate" });
      const nextState = result.runState.currentState;
      execFileSync(process.execPath, [BUMP_SCRIPT, runDir, nextState], {
        cwd: ROOT,
        stdio: "inherit",
        env: { ...process.env, RESEARCH_LOCK_HELD: "1" },
      });
      const pack = readJson(join(runDir, "context-pack.json"));
      const contextPackSnapshot =
        `snapshots/context-pack@v${pack.metadata.context_pack_version}.json`;
      appendReplayEntry(runDir, createReplayEntry({
        runDir,
        phase: stateName,
        nextPhase: nextState,
        workflowId: spec.workflowId,
        schemaVersion: spec.schemaVersion,
        contextPackSnapshot,
        artifacts: replayArtifacts(runDir, stateDef),
        gate,
        gateResult: "pass",
      }));
      console.log(
        JSON.stringify({ ok: true, gate, result: "pass", from: stateName, to: nextState }),
      );
      return;
    }

    const gateResult = runGateScript(gate, runDir);
    if (!gateResult.ok) {
      writeGateLastResult(runDir, {
        gate,
        result: "fail",
        reason: gateResult.reason,
      });
      appendObservation(runDir, {
        ts: new Date().toISOString(),
        actor: { type: "system", id: "research-cli" },
        phase: stateName,
        kind: "gate_result",
        payload: { gate, result: "fail", reason: gateResult.reason },
        contextPackVersion:
          readJson(join(runDir, "context-pack.json")).metadata?.context_pack_version ?? 1,
      });
      throw new Error(
        JSON.stringify({
          ok: false,
          gate,
          result: "fail",
          currentState: stateName,
          reason: gateResult.reason,
          runDir,
        }),
      );
    }

    const result = applyEvent(runDir, { type: "GATE_PASSED", gate });
    writeGateLastResult(runDir, { gate, result: "pass", reason: "pass" });
    const nextState = result.runState.currentState;
    execFileSync(process.execPath, [BUMP_SCRIPT, runDir, nextState], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, RESEARCH_LOCK_HELD: "1" },
    });
    const pack = readJson(join(runDir, "context-pack.json"));
    const contextPackSnapshot =
      `snapshots/context-pack@v${pack.metadata.context_pack_version}.json`;
    appendReplayEntry(runDir, createReplayEntry({
      runDir,
      phase: stateName,
      nextPhase: nextState,
      workflowId: spec.workflowId,
      schemaVersion: spec.schemaVersion,
      contextPackSnapshot,
      artifacts: replayArtifacts(runDir, stateDef),
      gate,
      gateResult: "pass",
    }));
    appendObservation(runDir, {
      ts: new Date().toISOString(),
      actor: { type: "system", id: "research-cli" },
      phase: stateName,
      kind: "gate_result",
      payload: { gate, result: "pass", nextState },
      contextPackVersion: pack.metadata?.context_pack_version ?? 1,
    });

    console.log(
      JSON.stringify({ ok: true, gate, result: "pass", from: stateName, to: nextState, runDir }),
    );
  });
}

async function cmdVerify(runDirArg, flags) {
  const runDir = resolveRunDir(runDirArg, flags);
  const result = await withRunLock(runDir, async () =>
    verifyRun(runDir, loadWorkflowSpec()),
  );
  const output = { ...result, runDir };
  if (!result.ok) {
    throw new Error(JSON.stringify(output));
  }
  console.log(JSON.stringify(output));
}

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  if (flags.help || args.length === 0) usage(args.length === 0 ? 1 : 0);

  const [cmd, ...rest] = args;
  switch (cmd) {
    case "init":
      cmdInit(rest[0], flags);
      break;
    case "status":
      cmdStatus(rest[0], flags);
      break;
    case "apply":
      await cmdApply(rest[0], rest[1], flags);
      break;
    case "advance":
      await cmdAdvance(rest[0], flags);
      break;
    case "verify":
      await cmdVerify(rest[0], flags);
      break;
    default:
      console.error(`unknown command: ${cmd}`);
      usage();
  }
}

// Exported for tests / programmatic use
export {
  applyEvent,
  resolveRunDir,
  writeGateLastResult,
  cmdInit,
  cmdAdvance,
  cmdStatus,
  cmdApply,
  cmdVerify,
  validateRunId,
};

const invokedAsCli =
  Boolean(process.argv[1]) &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsCli) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
