#!/usr/bin/env python3
"""Second-pass Gemini review:
  (1) retry the 6 rules that errored on the first pass (response-shape KeyError).
  (2) for any "drop" or "refine-pattern" verdict, ask Gemini for CONCRETE code
      improvements (specific AST patterns, regex changes, scope-handling) we
      could apply to make the rule ship-worthy. If still un-fixable, confirm
      the drop with deeper reasoning.

Output: analysis/RULE_REFINEMENT.md
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(
    0,
    "/Users/nasrmaswood/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal Blog/Agentic/scripts",
)
from analyze import call_vertex, V4_FLASH_MODEL, V4_FLASH_REGION  # noqa: E402

ROOT = Path(__file__).parent.parent
CROSS_REPO = ROOT / "analysis" / "cross-repo"
PRIOR = ROOT / "analysis" / "RULE_REVIEW.json"
OUT_JSON = ROOT / "analysis" / "RULE_REFINEMENT.json"
OUT_MD = ROOT / "analysis" / "RULE_REFINEMENT.md"

RULES = [
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


def extract_text(resp: dict) -> str:
    """Robust text extraction from Gemini Vertex response."""
    try:
        candidates = resp.get("candidates") or []
        if not candidates:
            return ""
        content = candidates[0].get("content") or {}
        parts = content.get("parts") or []
        return "".join(p.get("text", "") for p in parts)
    except Exception as e:
        return f"[extract_text error: {e}]"


def parse_json(text: str) -> dict | None:
    s = text.strip()
    if s.startswith("{"):
        try:
            return json.loads(s)
        except Exception:
            pass
    m = re.search(r"```(?:json)?\s*\n([\s\S]+?)\n?```", s)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    m = re.search(r"\{[\s\S]+\}", s)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return None


def collect_samples(rule_id: str, kind: str) -> tuple[dict[str, int], list[str]]:
    pattern = f"*__{rule_id}.txt" if kind != "ts" else f"*__ts-{rule_id}.txt"
    per_repo: dict[str, int] = {}
    samples: list[str] = []
    for f in sorted(CROSS_REPO.glob(pattern)):
        repo = f.name.split("__")[0]
        lines = f.read_text().splitlines()
        per_repo[repo] = len(lines)
        for line in lines[:2]:
            if line.strip():
                samples.append(line[:300])
        if len(samples) >= 12:
            break
    return per_repo, samples[:12]


VERDICT_PROMPT = """You are reviewing a custom lint rule for a public package
release. Output VALID JSON only (no markdown, no prose outside JSON).

## Rule

- id: `{rule_id}`
- kind: {kind}

## Source

```{lang}
{source}
```

## Cross-repo hits

{per_repo}
**Aggregate**: {total} hits across {n_repos} repos.

## Sample diagnostics

```
{samples}
```

Output schema (strict JSON, no other text):
{{"verdict": "ship" | "ship-as-warn" | "refine-pattern" | "drop",
  "reasoning": "1-3 sentences",
  "false_positive_risk": "low" | "medium" | "high",
  "missing_cases": ["..."],
  "suggested_refinement": "concrete code-level suggestion or null"}}
"""

REFINE_PROMPT = """We need to ship this lint rule to a public package. Gemini's
first-pass review flagged issues — see below. Your task: propose **concrete,
copy-pasteable code changes** to the rule's source so it ships cleanly.

If the rule fundamentally can't be made sensible (e.g., the heuristic is too
weak to ever be reliable), say so honestly and recommend dropping it.

## Rule

- id: `{rule_id}`
- kind: {kind}

## Current source

```{lang}
{source}
```

## First-pass verdict

- verdict: `{verdict}`
- reasoning: {reasoning}
- false_positive_risk: {fp_risk}
- missing_cases: {missing}

## Sample diagnostics (from real codebases)

```
{samples}
```

Output VALID JSON only. Schema:
{{"action": "patch-source" | "keep-as-warn" | "confirm-drop",
  "new_source": "the full new source as a string (only if action is patch-source); otherwise null",
  "patch_summary": "1-3 sentences explaining what changed and why",
  "final_severity": "error" | "warn" | "drop",
  "remaining_risks": "brief note on remaining false-positive risk after the patch, or null"}}

Rules for `new_source`:
- It must be a COMPLETE replacement for the source above (full file).
- For Python rules, keep the `Rule` subclass interface (id, code, description, check method).
- For ESLint rules, keep the `module.exports = {{meta, create}}` shape.
- Do NOT change the rule id, error code, or import paths.
- Prefer narrowing the pattern (fewer FPs) over broadening it.
"""


def first_pass(rule_id: str, kind: str, source_path: str) -> dict:
    source = (ROOT / source_path).read_text()
    per_repo, samples = collect_samples(rule_id, kind)
    total = sum(per_repo.values())
    lang = {"py": "python", "sql": "python", "ts": "javascript"}[kind]
    prompt = VERDICT_PROMPT.format(
        rule_id=rule_id, kind=kind, lang=lang,
        source=source[:6000],
        per_repo=json.dumps(per_repo, indent=2),
        total=total,
        n_repos=len(per_repo),
        samples="\n".join(samples) if samples else "(no hits)",
    )
    # Gemini 3.5 Flash uses ~1500-2500 thinking tokens before producing text;
    # bump the cap so we always get the actual JSON output.
    resp = call_vertex(V4_FLASH_MODEL, prompt, max_output_tokens=8000,
                      temperature=0.2, region=V4_FLASH_REGION)
    text = extract_text(resp)
    parsed = parse_json(text) or {"raw": text}
    parsed["rule_id"] = rule_id
    parsed["total_hits"] = total
    parsed["per_repo"] = per_repo
    return parsed


def refine_pass(rule_id: str, kind: str, source_path: str, first: dict) -> dict:
    source = (ROOT / source_path).read_text()
    per_repo, samples = collect_samples(rule_id, kind)
    lang = {"py": "python", "sql": "python", "ts": "javascript"}[kind]
    prompt = REFINE_PROMPT.format(
        rule_id=rule_id, kind=kind, lang=lang,
        source=source,
        verdict=first.get("verdict", "?"),
        reasoning=first.get("reasoning", ""),
        fp_risk=first.get("false_positive_risk", "?"),
        missing=", ".join(first.get("missing_cases", [])),
        samples="\n".join(samples) if samples else "(no hits)",
    )
    # The refine pass needs room for thinking + a full rule rewrite in JSON.
    resp = call_vertex(V4_FLASH_MODEL, prompt, max_output_tokens=20000,
                      temperature=0.2, region=V4_FLASH_REGION)
    text = extract_text(resp)
    parsed = parse_json(text) or {"raw": text}
    parsed["rule_id"] = rule_id
    return parsed


def main():
    os.environ.setdefault("VERTEX_ACCOUNT", "gemini-batch@sarj-bulbul.iam.gserviceaccount.com")
    prior = json.loads(PRIOR.read_text()) if PRIOR.exists() else []
    prior_by_id = {v["rule_id"]: v for v in prior if isinstance(v, dict)}

    final: list[dict] = []
    for rule_id, kind, source_path in RULES:
        p = prior_by_id.get(rule_id, {})
        # Retry if errored on first pass
        if "error" in p or "verdict" not in p:
            sys.stderr.write(f"[{rule_id}] first-pass retry...\n")
            try:
                p = first_pass(rule_id, kind, source_path)
            except Exception as e:
                p = {"rule_id": rule_id, "error": f"retry-failed: {e}"}
            time.sleep(1)

        record = {"rule_id": rule_id, "first_pass": p}
        verdict = p.get("verdict", "")

        if verdict in {"drop", "refine-pattern", "ship-as-warn"}:
            sys.stderr.write(f"[{rule_id}] refinement pass ({verdict})...\n")
            try:
                ref = refine_pass(rule_id, kind, source_path, p)
            except Exception as e:
                ref = {"rule_id": rule_id, "error": f"refine-failed: {e}"}
            record["refinement"] = ref
            time.sleep(1)

        final.append(record)
        OUT_JSON.write_text(json.dumps(final, indent=2))

    # Render markdown summary
    md = [
        "# Rule Refinement — Gemini 3.5 Flash deeper pass",
        "",
        "For rules with `drop` / `refine-pattern` / `ship-as-warn` verdicts, "
        "Gemini was asked to propose concrete code-level improvements. Patches "
        "below ship verbatim into the rule sources if `action=patch-source`.",
        "",
    ]
    for r in final:
        rid = r["rule_id"]
        first = r["first_pass"]
        verdict = first.get("verdict", "(no parse)")
        hits = first.get("total_hits", "?")
        md.append(f"## `{rid}` — first-pass: **{verdict}** ({hits} total hits)")
        md.append("")
        md.append(f"_{first.get('reasoning', '(no reasoning)')[:500]}_")
        md.append("")
        ref = r.get("refinement")
        if ref:
            action = ref.get("action", "?")
            sev = ref.get("final_severity", "?")
            md.append(f"### Refinement → **action: `{action}`**, final severity: `{sev}`")
            md.append("")
            md.append(ref.get("patch_summary", "(no summary)"))
            md.append("")
            risks = ref.get("remaining_risks")
            if risks:
                md.append(f"- remaining risks: {risks}")
            new_src = ref.get("new_source")
            if action == "patch-source" and new_src:
                md.append(f"- new source: {len(new_src):,} chars (saved to `analysis/patches/{rid}.txt`)")
                pdir = ROOT / "analysis" / "patches"
                pdir.mkdir(parents=True, exist_ok=True)
                (pdir / f"{rid}.txt").write_text(new_src)
            md.append("")
        md.append("---")
        md.append("")
    OUT_MD.write_text("\n".join(md))
    sys.stderr.write(f"[+] wrote {OUT_JSON} + {OUT_MD}\n")


if __name__ == "__main__":
    main()
