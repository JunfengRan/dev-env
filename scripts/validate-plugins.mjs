#!/usr/bin/env node
import {
  existsSync,
  readFileSync,
  realpathSync,
  readdirSync,
  statSync,
} from "node:fs";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

function readJson(path, errors, label) {
  if (!existsSync(path)) {
    errors.push(`${label} is missing: ${path}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${label} is invalid JSON: ${error.message}`);
    return null;
  }
}

function isSafeRelativePath(path) {
  if (typeof path !== "string" || path.length === 0 || isAbsolute(path)) {
    return false;
  }
  const normalized = normalize(path.replaceAll("\\", "/")).replaceAll("\\", "/");
  return normalized !== ".." && !normalized.startsWith("../");
}

function isInside(root, target) {
  const resolvedRoot = existsSync(root) ? realpathSync(root) : resolve(root);
  const resolvedTarget = existsSync(target) ? realpathSync(target) : resolve(target);
  const relativePath = relative(resolvedRoot, resolvedTarget);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function walkFiles(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walkFiles(join(path, entry.name))
      : [join(path, entry.name)],
  );
}

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return null;
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) return null;
  const fields = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return fields;
}

function validateReferencedPath(pluginDir, pluginName, field, value, errors) {
  if (typeof value !== "string") return;
  if (value.startsWith("https://") || value.startsWith("http://")) return;
  if (!isSafeRelativePath(value)) {
    errors.push(`${pluginName}: field "${field}" has invalid path "${value}"`);
    return;
  }
  const target = resolve(pluginDir, value);
  if (!isInside(pluginDir, target)) {
    errors.push(`${pluginName}: field "${field}" has invalid path "${value}"`);
  } else if (!existsSync(target)) {
    errors.push(`${pluginName}: field "${field}" references missing path "${value}"`);
  }
}

function validateComponentFrontmatter({
  pluginDir,
  pluginName,
  component,
  componentPath,
  matches,
  requiredFields,
  errors,
}) {
  if (typeof componentPath !== "string" || !isSafeRelativePath(componentPath)) {
    return;
  }
  const componentDir = resolve(pluginDir, componentPath);
  if (!isInside(pluginDir, componentDir) || !existsSync(componentDir)) return;
  for (const file of walkFiles(componentDir)) {
    if (!matches(file)) continue;
    const frontmatter = parseFrontmatter(readFileSync(file, "utf8"));
    const fileName = relative(pluginDir, file);
    if (!frontmatter) {
      errors.push(`${pluginName}: ${component} missing frontmatter: ${fileName}`);
      continue;
    }
    for (const field of requiredFields) {
      if (!frontmatter[field]) {
        errors.push(`${pluginName}: ${component} missing "${field}": ${fileName}`);
      }
    }
  }
}

function validateHooks(pluginDir, pluginName, hooksPath, errors) {
  if (typeof hooksPath !== "string" || !isSafeRelativePath(hooksPath)) return;
  const absolutePath = resolve(pluginDir, hooksPath);
  if (!isInside(pluginDir, absolutePath) || !existsSync(absolutePath)) return;
  const hooks = readJson(absolutePath, errors, `${pluginName} hooks`);
  if (!hooks) return;
  for (const entries of Object.values(hooks.hooks ?? {})) {
    for (const hook of Array.isArray(entries) ? entries : []) {
      if (
        typeof hook.command === "string" &&
        !hook.command.includes("${CURSOR_PLUGIN_ROOT}")
      ) {
        errors.push(
          `${pluginName}: hook command must reference \${CURSOR_PLUGIN_ROOT}`,
        );
      }
    }
  }
}

export async function validateMarketplace(root) {
  const errors = [];
  const warnings = [];
  const marketplacePath = join(root, ".cursor-plugin", "marketplace.json");
  const marketplace = readJson(marketplacePath, errors, "marketplace manifest");
  if (!marketplace) return { errors, warnings };

  if (!NAME_PATTERN.test(marketplace.name ?? "")) {
    errors.push("marketplace name must be lowercase kebab-case");
  }
  if (!marketplace.owner?.name) {
    errors.push("marketplace owner.name is required");
  }
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    errors.push("marketplace plugins must be a non-empty array");
    return { errors, warnings };
  }

  const names = new Set();
  for (const entry of marketplace.plugins) {
    if (!NAME_PATTERN.test(entry?.name ?? "")) {
      errors.push(`invalid marketplace plugin name: ${entry?.name ?? ""}`);
      continue;
    }
    if (names.has(entry.name)) {
      errors.push(`duplicate marketplace plugin name: ${entry.name}`);
    }
    names.add(entry.name);
    if (!isSafeRelativePath(entry.source)) {
      errors.push(`${entry.name}: source has invalid path "${entry.source}"`);
      continue;
    }
    const pluginDir = resolve(root, entry.source);
    if (!isInside(root, pluginDir) || !existsSync(pluginDir)) {
      errors.push(`${entry.name}: source directory is missing or outside repository`);
      continue;
    }
    const manifest = readJson(
      join(pluginDir, ".cursor-plugin", "plugin.json"),
      errors,
      `${entry.name} plugin manifest`,
    );
    if (!manifest) continue;
    for (const field of ["name", "version", "description"]) {
      if (typeof manifest[field] !== "string" || manifest[field].length === 0) {
        errors.push(`${entry.name}: plugin manifest requires "${field}"`);
      }
    }
    if (manifest.name !== entry.name) {
      errors.push(
        `${entry.name}: marketplace name does not match plugin name "${manifest.name}"`,
      );
    }
    for (const field of [
      "logo",
      "rules",
      "skills",
      "agents",
      "commands",
      "hooks",
      "mcpServers",
    ]) {
      const values = Array.isArray(manifest[field])
        ? manifest[field]
        : [manifest[field]];
      for (const value of values) {
        validateReferencedPath(pluginDir, entry.name, field, value, errors);
      }
    }
    for (const skillsPath of Array.isArray(manifest.skills)
      ? manifest.skills
      : [manifest.skills]) {
      validateComponentFrontmatter({
        pluginDir,
        pluginName: entry.name,
        component: "skill",
        componentPath: skillsPath,
        matches: (file) => file.endsWith("SKILL.md"),
        requiredFields: ["name", "description"],
        errors,
      });
    }
    for (const [field, component, requiredFields] of [
      ["rules", "rule", ["description"]],
      ["agents", "agent", ["name", "description"]],
      ["commands", "command", ["name", "description"]],
    ]) {
      for (const componentPath of Array.isArray(manifest[field])
        ? manifest[field]
        : [manifest[field]]) {
        validateComponentFrontmatter({
          pluginDir,
          pluginName: entry.name,
          component,
          componentPath,
          matches: (file) => /\.(?:md|mdc|markdown)$/i.test(file),
          requiredFields,
          errors,
        });
      }
    }
    validateHooks(pluginDir, entry.name, manifest.hooks, errors);
  }

  return { errors, warnings };
}

async function main() {
  const result = await validateMarketplace(process.cwd());
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`ERROR ${error}`);
    process.exit(1);
  }
  console.log("Plugin validation passed.");
}

const invokedAsCli =
  Boolean(process.argv[1]) &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedAsCli) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
