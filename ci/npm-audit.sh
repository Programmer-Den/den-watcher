#!/usr/bin/env bash
# Fails like `npm audit --audit-level=high`, except for the advisories listed
# in frontend/audit-allow.txt: ones with no fixed version yet, in tools that
# only build or test the page, never in what is shipped. Each line there is a
# GHSA id, then a comment; remove it once npm audit no longer reports it.
# What the page ships with is checked without any allowance.
# Pass --package-lock-only to read only the lock file.
set -euo pipefail

cd "$(dirname "$0")/../frontend"
npm audit --omit=dev --audit-level=high "$@"
# The report goes in on stdin: it can be larger than an environment variable
# may be. The script is JavaScript, whose ${...} the shell must leave alone.
# shellcheck disable=SC2016
{ npm audit --json "$@" || true; } | node -e '
const fs = require("fs");
const allowed = new Set(
  fs.readFileSync("audit-allow.txt", "utf8").split("\n")
    .map((line) => line.replace(/#.*/, "").trim()).filter(Boolean),
);
const report = JSON.parse(fs.readFileSync(0, "utf8"));
if (report.error) {
  console.error(`npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`);
  process.exit(1);
}
const found = new Map();
for (const v of Object.values(report.vulnerabilities ?? {})) {
  for (const via of v.via) {
    if (typeof via === "object" && ["high", "critical"].includes(via.severity)) {
      found.set((via.url ?? `${via.name} ${via.source}`).split("/").pop(), `${via.severity}: ${via.name} ${via.range}, ${via.title} (${via.url})`);
    }
  }
}
let failed = false;
for (const [id, text] of found) {
  if (allowed.has(id)) {
    console.log(`allowed until fixed: ${text}`);
  } else {
    console.log(`::error::${text}`);
    failed = true;
  }
}
for (const id of allowed) {
  if (!found.has(id)) {
    console.log(`::warning::${id} is no longer reported; remove it from frontend/audit-allow.txt`);
  }
}
if (failed) {
  process.exit(1);
}
console.log("No high or critical vulnerabilities besides the allowed ones.");
'
