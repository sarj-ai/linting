#!/usr/bin/env node
/**
 * Standalone ESLint driver for cross-repo validation.
 * Usage: node run_eslint.js <rule-id> <repo-root>
 *
 * Loads our plugin's rule directly + runs ESLint over .ts/.tsx files in the repo.
 * Outputs `path:line:col: SARJ-eslint/<rule-id> message` per finding.
 */

const path = require("path");
const fs = require("fs");
const { Linter } = require("eslint");
const sarjPlugin = require("../packages/eslint-plugin/lib/index.js");

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".yarn",
  ".pnpm-store",
  ".git",
]);

function walk(dir, out, depth) {
  if (depth > 30) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== "." && e.name !== "..") {
      if (SKIP_DIRS.has(e.name)) continue;
    }
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p, out, depth + 1);
    } else if (e.isFile()) {
      if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
        // skip large files
        let size;
        try {
          size = fs.statSync(p).size;
        } catch (_) {
          continue;
        }
        if (size > 500_000) continue;
        out.push(p);
      }
    }
  }
}

function main() {
  const ruleId = process.argv[2];
  const repoRoot = process.argv[3];
  if (!ruleId || !repoRoot) {
    process.stderr.write("usage: run_eslint.js <rule-id> <repo-root>\n");
    process.exit(2);
  }
  if (!sarjPlugin.rules[ruleId]) {
    process.stderr.write(`unknown rule: ${ruleId}\n`);
    process.exit(2);
  }
  const linter = new Linter();
  linter.defineRule(`sarj/${ruleId}`, sarjPlugin.rules[ruleId]);

  const files = [];
  walk(repoRoot, files, 0);

  let hitCount = 0;
  for (const file of files) {
    let src;
    try {
      src = fs.readFileSync(file, "utf8");
    } catch (_) {
      continue;
    }
    let messages;
    try {
      messages = linter.verify(
        src,
        {
          parserOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            ecmaFeatures: { jsx: true },
          },
          rules: {
            [`sarj/${ruleId}`]: "error",
          },
        },
        { filename: file }
      );
    } catch (e) {
      // parser error on weird TS — skip
      continue;
    }
    for (const m of messages) {
      hitCount++;
      process.stdout.write(
        `${file}:${m.line}:${m.column}: sarj/${ruleId} ${m.message}\n`
      );
    }
  }
  process.stderr.write(`[${ruleId}] scanned ${files.length} files, ${hitCount} hits\n`);
}

main();
