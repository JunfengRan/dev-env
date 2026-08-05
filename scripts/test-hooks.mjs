#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = [
  {
    hook: "plugins/deep-research-gates/hooks/before-phase-transition.ts",
    input: { conversation_id: "ci-smoke", status: "completed", loop_count: 1 },
  },
  {
    hook: "plugins/continual-learning-rules/hooks/continual-learning-stop.ts",
    input: { conversation_id: "ci-smoke", status: "completed", loop_count: 1 },
  },
];

let failed = 0;
for (const fixture of fixtures) {
  const executable = process.platform === "win32" ? "powershell.exe" : "bun";
  const args =
    process.platform === "win32"
      ? ["-NoProfile", "-NonInteractive", "-Command", `bun run "${fixture.hook}"`]
      : ["run", fixture.hook];
  const result = spawnSync(executable, args, {
    cwd: ROOT,
    input: JSON.stringify(fixture.input),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(`FAIL ${fixture.hook}: ${result.stderr || result.error?.message}`);
    failed += 1;
    continue;
  }
  const output = result.stdout.trim();
  if (output) {
    try {
      JSON.parse(output);
    } catch {
      console.error(`FAIL ${fixture.hook}: output is not JSON: ${output}`);
      failed += 1;
      continue;
    }
  }
  console.log(`OK ${fixture.hook}`);
}

if (failed > 0) process.exit(1);
console.log("\nAll hook smoke tests passed.");
