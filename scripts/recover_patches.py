#!/usr/bin/env python3
"""Pull patches out of RULE_REFINEMENT.json's raw-text entries.

Gemini sometimes returns ```json fenced JSON containing embedded newlines /
escaped quotes that my simpler regex couldn't parse. Use json.loads with
fence-stripping and write each `new_source` to analysis/patches/<rule>.txt.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
PATCHES_DIR = ROOT / "analysis" / "patches"
PATCHES_DIR.mkdir(parents=True, exist_ok=True)


def strip_fence(s: str) -> str:
    m = re.search(r"```(?:json)?\s*\n([\s\S]+?)\n?```", s)
    if m:
        return m.group(1)
    return s.strip()


def main() -> None:
    data = json.loads((ROOT / "analysis" / "RULE_REFINEMENT.json").read_text())
    recovered = 0
    for r in data:
        rid = r["rule_id"]
        ref = r.get("refinement", {})
        if "action" in ref:
            continue
        raw = ref.get("raw", "")
        if not raw:
            print(f"  [{rid}] no raw text — needs retry")
            continue
        body = strip_fence(raw)
        try:
            parsed = json.loads(body)
        except Exception as e:
            print(f"  [{rid}] json parse FAILED: {e}")
            continue
        new_source = parsed.get("new_source")
        action = parsed.get("action")
        sev = parsed.get("final_severity")
        if action == "patch-source" and new_source:
            (PATCHES_DIR / f"{rid}.txt").write_text(new_source)
            recovered += 1
            print(f"  [{rid}] action={action}, severity={sev} — saved patch ({len(new_source):,} chars)")
        else:
            print(f"  [{rid}] action={action} (no patch needed)")
        # write back into the data so RULE_REFINEMENT.json has the parsed fields
        ref["action"] = action
        ref["new_source"] = new_source
        ref["final_severity"] = sev
        ref["patch_summary"] = parsed.get("patch_summary", "")
        ref["remaining_risks"] = parsed.get("remaining_risks", "")
    (ROOT / "analysis" / "RULE_REFINEMENT.json").write_text(
        json.dumps(data, indent=2)
    )
    print(f"\n[+] recovered {recovered} additional patches")


if __name__ == "__main__":
    main()
