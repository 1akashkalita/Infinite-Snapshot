#!/usr/bin/env node
// Quality gate runner.
//
// Runs every check in sequence and records each result independently. It does
// NOT short-circuit on the first failure, so a single run reports the full
// health of the repo (fix everything once, instead of fix-rerun-fix-rerun).
// Exits non-zero if any check failed.
import { spawnSync } from "node:child_process";

const checks = ["typecheck", "lint", "format:check", "test"];

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const results = [];

for (const name of checks) {
  console.log(`\n─── verify: ${name} ───`);
  const proc = spawnSync(npm, ["run", name], { stdio: "inherit" });
  results.push({ name, passed: proc.status === 0 });
}

console.log("\n=== verify summary ===");
for (const { name, passed } of results) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
}

const failed = results.filter((r) => !r.passed);
if (failed.length > 0) {
  const names = failed.map((r) => r.name).join(", ");
  console.error(`\n${failed.length} check(s) FAILED: ${names}`);
  process.exit(1);
}

console.log("\nAll checks passed.");
process.exit(0);
