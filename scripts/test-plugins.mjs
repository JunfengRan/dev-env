#!/usr/bin/env node
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateMarketplace } from "./validate-plugins.mjs";

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

function createFixture(root) {
  const pluginDir = join(root, "plugins", "sample");
  mkdirSync(join(root, ".cursor-plugin"), { recursive: true });
  mkdirSync(join(pluginDir, ".cursor-plugin"), { recursive: true });
  mkdirSync(join(pluginDir, "skills", "sample"), { recursive: true });
  mkdirSync(join(pluginDir, "hooks"), { recursive: true });
  writeJson(join(root, ".cursor-plugin", "marketplace.json"), {
    name: "fixture-marketplace",
    owner: { name: "Fixture" },
    plugins: [{ name: "sample", source: "./plugins/sample" }],
  });
  writeJson(join(pluginDir, ".cursor-plugin", "plugin.json"), {
    name: "sample",
    description: "fixture plugin",
    version: "1.0.0",
    skills: "./skills/",
    hooks: "./hooks/hooks.json",
  });
  writeFileSync(
    join(pluginDir, "skills", "sample", "SKILL.md"),
    "---\nname: sample\ndescription: fixture\n---\n\n# Sample\n",
    "utf8",
  );
  writeJson(join(pluginDir, "hooks", "hooks.json"), {
    version: 1,
    hooks: {
      stop: [{ command: "bun run ${CURSOR_PLUGIN_ROOT}/hooks/sample.ts" }],
    },
  });
  writeFileSync(join(pluginDir, "hooks", "sample.ts"), "", "utf8");
}

async function main() {
  const root = mkdtempSync(join(tmpdir(), "plugin-validation-"));
  try {
    createFixture(root);
    let result = await validateMarketplace(root);
    assert("valid marketplace fixture passes", result.errors.length === 0, result.errors.join("; "));

    const marketplacePath = join(root, ".cursor-plugin", "marketplace.json");
    const validMarketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
    writeJson(marketplacePath, {
      ...validMarketplace,
      plugins: [{ name: "wrong-name", source: "./plugins/sample" }],
    });
    result = await validateMarketplace(root);
    assert(
      "marketplace and plugin names must match",
      result.errors.some((error) => error.includes("does not match")),
      result.errors.join("; "),
    );

    writeJson(marketplacePath, validMarketplace);
    const manifestPath = join(
      root,
      "plugins",
      "sample",
      ".cursor-plugin",
      "plugin.json",
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    writeJson(manifestPath, { ...manifest, skills: "../outside" });
    result = await validateMarketplace(root);
    assert(
      "plugin path escape is rejected",
      result.errors.some((error) => error.includes("invalid path")),
      result.errors.join("; "),
    );

    rmSync(join(root, ".cursor-plugin", "marketplace.json"));
    result = await validateMarketplace(root);
    assert(
      "missing marketplace manifest is rejected",
      result.errors.some((error) => error.includes("missing")),
      result.errors.join("; "),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  if (failed > 0) {
    console.error(`\n${failed} plugin validation test(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll plugin validation tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
