#!/usr/bin/env python3
"""Cross-repo validation: run new rules against all locally-cloned sarj-ai repos.

Captures per-rule:
  - hit count per repo
  - up to 10 sample violations with file:line context
Output: ../analysis/cross-repo-results.json
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

LOCAL_REPOS_ROOT = Path.home() / "code"
TARGET_REPOS = [
    "bulbul",
    "noura-be",
    "tahded",
    "kashta",
    "hala",
    "portal",
    "ai",
    "automations",
    "summer",
    "agentic",
]

PYTHON_RULES = [
    "no-sequential-await",
    "inefficient-string-concat-in-loop",
    "no-in-app-aggregation",
    "prefer-pydantic-returns",
    "prefer-discriminated-union",
    "prefer-str-enum",
]
SQL_RULES = ["enforce-timestamptz", "detect-on-conflict-without-unique"]
TS_RULES = [
    "no-client-side-data-fetching",
    "prefer-server-actions",
    "no-unnecessary-use-client",
    "prefer-schema-for-api-payload",
]

OUT_DIR = Path(__file__).parent.parent / "analysis"
OUT_FILE = OUT_DIR / "cross-repo-results.json"
LINT_ROOT = Path(__file__).parent.parent

# Paths inside repos that are noise (vendored, generated, test fixtures)
SKIP_PATTERNS = [
    "/node_modules/",
    "/.venv/",
    "/dist/",
    "/build/",
    "/.next/",
    "/coverage/",
    "/__pycache__/",
    "/.pytest_cache/",
    "/migrations/",  # SQL rule will scan migrations directly
]


def find_files(repo: Path, extensions: list[str]) -> list[Path]:
    out: list[Path] = []
    for ext in extensions:
        for p in repo.rglob(f"*{ext}"):
            spath = str(p)
            if any(skip in spath for skip in SKIP_PATTERNS):
                continue
            if p.stat().st_size > 500_000:  # skip very large files
                continue
            out.append(p)
    return out


def find_sql_migrations(repo: Path) -> list[Path]:
    """SQL rules ONLY scan migration files."""
    candidates: list[Path] = []
    for mig_dir in repo.rglob("migrations"):
        if not mig_dir.is_dir():
            continue
        if any(skip in str(mig_dir) for skip in SKIP_PATTERNS if "migrations" not in skip):
            continue
        candidates.extend(mig_dir.rglob("*.sql"))
    return candidates


def run_python_rule(rule_id: str, files: list[Path]) -> list[str]:
    """Run sarj-python-lint check --rule X on files. Return diagnostic lines."""
    if not files:
        return []
    cmd = [
        "uv",
        "run",
        "--directory",
        str(LINT_ROOT / "packages" / "python-lint"),
        "sarj-python-lint",
        "check",
        "--rule",
        rule_id,
        *[str(f) for f in files],
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except subprocess.TimeoutExpired:
        return [f"TIMEOUT after 600s for {rule_id}"]
    return [line for line in res.stdout.splitlines() if line.strip()]


def run_ts_rule(rule_id: str, repo: Path) -> list[str]:
    """Run our standalone Node lint driver against repo. Returns diagnostics."""
    # See run_eslint.js
    driver = LINT_ROOT / "scripts" / "run_eslint.js"
    if not driver.exists():
        return []
    cmd = ["node", str(driver), rule_id, str(repo)]
    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,
            cwd=str(LINT_ROOT / "packages" / "eslint-plugin"),
        )
    except subprocess.TimeoutExpired:
        return [f"TIMEOUT after 600s for {rule_id}"]
    return [line for line in res.stdout.splitlines() if line.strip()]


def summarize(diagnostics: list[str], sample_size: int = 10) -> dict:
    return {
        "hits": len(diagnostics),
        "samples": diagnostics[:sample_size],
    }


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUT_FILE.exists() and not os.environ.get("FORCE_RECHECK"):
        prev = json.loads(OUT_FILE.read_text())
        sys.stderr.write(f"Loaded cached results from {OUT_FILE}\n")
    else:
        prev = {}

    results: dict = prev.get("results", {})

    for repo_name in TARGET_REPOS:
        repo = LOCAL_REPOS_ROOT / repo_name
        if not repo.exists():
            sys.stderr.write(f"  skip {repo_name} — not cloned\n")
            continue
        sys.stderr.write(f"== {repo_name} ==\n")

        py_files = find_files(repo, [".py"])
        ts_files_count = len(find_files(repo, [".ts", ".tsx"]))
        sql_files = find_sql_migrations(repo)
        sys.stderr.write(
            f"   {len(py_files)} .py, {ts_files_count} .ts/.tsx, {len(sql_files)} .sql (migrations)\n"
        )

        repo_results = results.setdefault(repo_name, {})

        for rule_id in PYTHON_RULES:
            key = f"py:{rule_id}"
            if key in repo_results:
                continue
            sys.stderr.write(f"   - {rule_id}... ")
            diags = run_python_rule(rule_id, py_files)
            repo_results[key] = summarize(diags)
            sys.stderr.write(f"{len(diags)} hits\n")

        for rule_id in SQL_RULES:
            key = f"sql:{rule_id}"
            if key in repo_results:
                continue
            sys.stderr.write(f"   - {rule_id}... ")
            diags = run_python_rule(rule_id, sql_files)
            repo_results[key] = summarize(diags)
            sys.stderr.write(f"{len(diags)} hits\n")

        for rule_id in TS_RULES:
            key = f"ts:{rule_id}"
            if key in repo_results:
                continue
            sys.stderr.write(f"   - {rule_id}... ")
            diags = run_ts_rule(rule_id, repo)
            repo_results[key] = summarize(diags)
            sys.stderr.write(f"{len(diags)} hits\n")

        OUT_FILE.write_text(json.dumps({"results": results}, indent=2))

    sys.stderr.write(f"\n[+] wrote {OUT_FILE}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
