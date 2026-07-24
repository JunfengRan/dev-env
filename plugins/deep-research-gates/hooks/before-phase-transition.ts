/// <reference types="bun-types-no-globals/lib/index.d.ts" />

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { stdin } from "bun";

const RESEARCH_DIR = resolve(".research");
const CLI = resolve("scripts/research-cli.mjs");

interface StopHookInput {
  conversation_id: string;
  status: string;
  loop_count: number;
}

function findActiveRunDir(): string | null {
  if (process.env.RESEARCH_RUN_ID) {
    const path = join(RESEARCH_DIR, process.env.RESEARCH_RUN_ID);
    return existsSync(join(path, "state.json")) ? path : null;
  }
  if (!existsSync(RESEARCH_DIR)) return null;
  const runs = readdirSync(RESEARCH_DIR)
    .map((name) => join(RESEARCH_DIR, name))
    .filter((p) => existsSync(join(p, "state.json")))
    .map((p) => {
      const state = JSON.parse(readFileSync(join(p, "state.json"), "utf8"));
      return { path: p, state, mtimeMs: statSync(join(p, "state.json")).mtimeMs };
    })
    .filter((c) => c.state.currentState !== "done" && c.state.currentState !== "aborted")
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return runs[0]?.path ?? null;
}

async function main() {
  const raw = await stdin.text();
  if (!raw.trim()) {
    process.exit(0);
  }

  let input: StopHookInput;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  if (input.status === "aborted" || input.status === "error") {
    process.exit(0);
  }

  if (!existsSync(CLI)) {
    process.exit(0);
  }

  const runDir = findActiveRunDir();
  if (!runDir) {
    process.exit(0);
  }

  const state = JSON.parse(readFileSync(join(runDir, "state.json"), "utf8"));
  if (state.currentState === "done" || state.currentState === "aborted") {
    process.exit(0);
  }

  try {
    execFileSync(process.execPath, [CLI, "advance", runDir], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    process.exit(0);
  } catch (err) {
    const stderr = (err as { stderr?: string | Buffer }).stderr?.toString?.() ?? "gate failed";
    let reason = stderr.trim();
    try {
      const parsed = JSON.parse(reason);
      reason = parsed.reason ?? reason;
    } catch {
      // keep raw stderr
    }

    const packPath = join(runDir, "context-pack.json");
    const gate =
      existsSync(packPath)
        ? JSON.parse(readFileSync(packPath, "utf8")).L1_session_anchor?.gateLastResult?.gate
        : "unknown";

    const message =
      `Deep research gate "${gate ?? "unknown"}" failed for state "${state.currentState}". ` +
      `Fix artifacts under ${runDir} then re-run: node scripts/research-cli.mjs advance "${runDir}". ` +
      `Reason: ${reason}`;

    console.log(JSON.stringify({ followup_message: message }));
    process.exit(0);
  }
}

main().catch(() => process.exit(0));
