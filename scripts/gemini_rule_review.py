#!/usr/bin/env python3
"""Ask Gemini 3.5 Flash to judge each new lint rule's sensibility.

For each of the 12 new rules, sends Gemini:
  - the rule's purpose/description
  - the actual rule code (so it can spot pattern issues)
  - up to 8 sample violations from real codebases
  - aggregate hit counts per repo
Receives back: keep / refine / drop verdict + reasoning.

Output: analysis/RULE_REVIEW.md
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

# Reuse the Vertex call shim already battle-tested in the prior pipeline.
sys.path.insert(
    0,
    "/Users/nasrmaswood/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal Blog/Agentic/scripts",
)
from analyze import call_vertex, V4_FLASH_MODEL, V4_FLASH_REGION  # noqa: E402

ROOT = Path(__file__).parent.parent
CROSS_REPO = ROOT / "analysis" / "cross-repo"
OUT_MD = ROOT / "analysis" / "RULE_REVIEW.md"

RULES = [
    # id, kind, source_path
    ("no-sequential-await", "py", "packages/python-lint/src/sarj_python_lint/rules/no_sequential_await.py"),
    ("inefficient-string-concat-in-loop", "py", "packages/python-lint/src/sarj_python_lint/rules/inefficient_string_concat_in_loop.py"),
    ("no-in-app-aggregation", "py", "packages/python-lint/src/sarj_python_lint/rules/no_in_app_aggregation.py"),
    ("prefer-pydantic-returns", "py", "packages/python-lint/src/sarj_python_lint/rules/prefer_pydantic_returns.py"),
    ("prefer-discriminated-union", "py", "packages/python-lint/src/sarj_python_lint/rules/prefer_discriminated_union.py"),
    ("prefer-str-enum", "py", "packages/python-lint/src/sarj_python_lint/rules/prefer_str_enum.py"),
    ("enforce-timestamptz", "sql", "packages/python-lint/src/sarj_python_lint/rules/enforce_timestamptz.py"),
    ("detect-on-conflict-without-unique", "sql", "packages/python-lint/src/sarj_python_lint/rules/detect_on_conflict_without_unique.py"),
    ("no-client-side-data-fetching", "ts", "packages/eslint-plugin/lib/rules/no-client-side-data-fetching.js"),
    ("prefer-server-actions", "ts", "packages/eslint-plugin/lib/rules/prefer-server-actions.js"),
    ("no-unnecessary-use-client", "ts", "packages/eslint-plugin/lib/rules/no-unnecessary-use-client.js"),
    ("prefer-schema-for-api-payload", "ts", "packages/eslint-plugin/lib/rules/prefer-schema-for-api-payload.js"),
]


def collect_samples(rule_id: str, kind: str) -> tuple[dict[str, int], list[str]]:
    """Return per-repo hit counts + a small sample of diagnostic lines (across repos)."""
    pattern = f"*__{rule_id}.txt" if kind != "ts" else f"*__ts-{rule_id}.txt"
    per_repo: dict[str, int] = {}
    samples: list[str] = []
    for f in sorted(CROSS_REPO.glob(pattern)):
        repo = f.name.split("__")[0]
        lines = f.read_text().splitlines()
        per_repo[repo] = len(lines)
        # Take 1-2 samples per repo
        for line in lines[:2]:
            if line.strip():
                samples.append(line[:300])  # truncate long lines
        if len(samples) >= 12:
            break
    return per_repo, samples[:12]


PROMPT = """You are reviewing a custom lint rule for a Python+TypeScript engineering team to decide whether the rule is sensible enough to ship publicly to PyPI / npm.

## Rule

- **id**: `{rule_id}`
- **kind**: {kind}

## Rule source

```{lang}
{source}
```

## Cross-repo behavior

Run against {n_repos} real codebases. Per-repo hit counts:

{per_repo}

**Aggregate**: {total} hits.

## Sample diagnostics (real production code)

```
{samples}
```

## Your task

Answer in JSON ONLY (no other text):

```json
{{
  "verdict": "ship" | "ship-as-warn" | "refine-pattern" | "drop",
  "reasoning": "1-3 sentences explaining the choice",
  "false_positive_risk": "low" | "medium" | "high",
  "missing_cases": ["..."],  // patterns this rule probably misses; empty array if none
  "suggested_refinement": "concrete suggestion if verdict is refine-pattern or ship-as-warn, otherwise null"
}}
```

Criteria:
- **ship**: rule fires on real anti-patterns, low FP risk, hits look legitimate.
- **ship-as-warn**: useful rule but FP-prone — start at warn-level, promote to error after grandfathering existing hits.
- **refine-pattern**: rule has the right intent but the matching is wrong — needs tweaking before publish.
- **drop**: pattern doesn't generalize / too many FPs / better solved by another tool.

Be concise and honest. We'd rather drop a mediocre rule than ship 12 mediocre rules.
"""


def review_rule(rule_id: str, kind: str, source_path: str) -> dict:
    source = (ROOT / source_path).read_text()
    per_repo, samples = collect_samples(rule_id, kind)
    total = sum(per_repo.values())
    lang = {"py": "python", "sql": "python", "ts": "javascript"}[kind]
    prompt = PROMPT.format(
        rule_id=rule_id,
        kind=kind,
        lang=lang,
        source=source[:6000],  # cap source size
        per_repo=json.dumps(per_repo, indent=2),
        total=total,
        samples="\n".join(samples) if samples else "(no hits)",
        n_repos=len(per_repo),
    )
    resp = call_vertex(
        V4_FLASH_MODEL,
        prompt,
        max_output_tokens=2000,
        temperature=0.2,
        region=V4_FLASH_REGION,
    )
    text = "".join(p.get("text", "") for p in resp["candidates"][0]["content"]["parts"])
    # Extract JSON
    import re
    m = re.search(r"\{[\s\S]+\}", text)
    if not m:
        return {"raw": text, "rule_id": rule_id, "total": total, "per_repo": per_repo}
    try:
        verdict = json.loads(m.group(0))
        verdict["rule_id"] = rule_id
        verdict["total_hits"] = total
        verdict["per_repo"] = per_repo
        return verdict
    except json.JSONDecodeError:
        return {"raw": text, "rule_id": rule_id, "total": total, "per_repo": per_repo}


def main():
    os.environ.setdefault("VERTEX_ACCOUNT", "gemini-batch@sarj-bulbul.iam.gserviceaccount.com")
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    verdicts: list[dict] = []
    for rule_id, kind, source_path in RULES:
        sys.stderr.write(f"reviewing {rule_id}...\n")
        try:
            v = review_rule(rule_id, kind, source_path)
        except Exception as e:
            v = {"rule_id": rule_id, "error": str(e)}
        verdicts.append(v)
        # incremental save
        json_out = OUT_MD.with_suffix(".json")
        json_out.write_text(json.dumps(verdicts, indent=2))
        time.sleep(1)  # gentle throttle

    # Render markdown
    md = ["# Rule Review — Gemini 3.5 Flash sensibility judge", "",
          f"Reviewed {len(verdicts)} rules against real-codebase hits.", ""]
    for v in verdicts:
        rid = v.get("rule_id", "?")
        verdict = v.get("verdict", "(no parse)")
        hits = v.get("total_hits", "?")
        reasoning = v.get("reasoning", v.get("raw", "(no text)"))[:600]
        md.append(f"## `{rid}` — **{verdict}** ({hits} total hits)")
        md.append("")
        md.append(reasoning)
        md.append("")
        fp = v.get("false_positive_risk")
        if fp:
            md.append(f"- false-positive risk: **{fp}**")
        ref = v.get("suggested_refinement")
        if ref:
            md.append(f"- refinement: {ref}")
        miss = v.get("missing_cases") or []
        if miss:
            md.append(f"- missing cases: {', '.join(miss[:5])}")
        md.append("")
    OUT_MD.write_text("\n".join(md))
    sys.stderr.write(f"[+] wrote {OUT_MD}\n")


if __name__ == "__main__":
    main()
