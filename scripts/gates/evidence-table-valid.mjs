#!/usr/bin/env node
import { existsSync } from "node:fs";
import { fail, pass, readJson, listEvidenceFiles } from "../gate-utils.mjs";

const runDir = process.argv[2];
if (!runDir) fail("usage: evidence-table-valid.mjs <run-dir>");

const files = listEvidenceFiles(runDir);
if (files.length === 0) {
  fail("no artifacts/evidence/*.json files found");
}

const validVerdicts = new Set(["true", "partial", "false"]);

for (const file of files) {
  const data = readJson(file);
  const rows = Array.isArray(data.rows) ? data.rows : [data];
  for (const row of rows) {
    if (!row.claim) fail(`${file}: missing claim`);
    if (!validVerdicts.has(row.verdict)) {
      fail(`${file}: verdict must be true|partial|false`);
    }
    if (!row.filePath) fail(`${file}: missing filePath`);
  }
}

pass(`evidence-table-valid: ok (${files.length} file(s))`);
