#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

const root = process.cwd();
const workflowDir = join(root, ".github", "workflows");
const errors = [];

for (const name of readdirSync(workflowDir).filter((file) =>
  /\.ya?ml$/i.test(file),
)) {
  const path = join(workflowDir, name);
  let workflow;
  try {
    workflow = YAML.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${name}: invalid YAML: ${error.message}`);
    continue;
  }
  if (workflow.permissions?.contents !== "read") {
    errors.push(`${name}: top-level permissions.contents must be read`);
  }
  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    if (!Number.isInteger(job["timeout-minutes"]) || job["timeout-minutes"] <= 0) {
      errors.push(`${name}:${jobName}: timeout-minutes is required`);
    }
    for (const step of job.steps ?? []) {
      if (
        typeof step.uses === "string" &&
        !step.uses.startsWith("./") &&
        !/@[a-f0-9]{40}$/.test(step.uses)
      ) {
        errors.push(`${name}:${jobName}: action is not SHA-pinned: ${step.uses}`);
      }
    }
  }
}

try {
  YAML.parse(readFileSync(join(root, ".github", "dependabot.yml"), "utf8"));
} catch (error) {
  errors.push(`dependabot.yml: invalid YAML: ${error.message}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exit(1);
}
console.log("CI configuration validation passed.");
