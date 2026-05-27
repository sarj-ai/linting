"""SARJ101: detect TIMESTAMP columns missing `WITH TIME ZONE`.

Postgres `TIMESTAMP` without `WITH TIME ZONE` discards offset on INSERT,
silently producing wrong timestamps for non-UTC clients. Use TIMESTAMPTZ.
"""
from __future__ import annotations

import re
from pathlib import Path

from sarj_sql_lint.rule_base import Diagnostic, Rule


PATTERN = re.compile(
    r"\bTIMESTAMP\b(?!\s*TZ\b)(?!\s+WITH\s+TIME\s+ZONE\b)",
    re.IGNORECASE,
)


class EnforceTimestamptz(Rule):
    id = "enforce-timestamptz"
    code = "SARJ101"
    description = "TIMESTAMP without TIME ZONE — use TIMESTAMPTZ."

    def check(self, path: Path, source: str) -> list[Diagnostic]:
        diags: list[Diagnostic] = []
        for lineno, line in enumerate(source.splitlines(), start=1):
            stripped = line.lstrip()
            if stripped.startswith("--") or stripped.startswith("/*"):
                continue
            for match in PATTERN.finditer(line):
                diags.append(
                    Diagnostic(
                        path=path,
                        line=lineno,
                        col=match.start() + 1,
                        code=self.code,
                        message=(
                            "Use `TIMESTAMPTZ` (or `TIMESTAMP WITH TIME ZONE`) — "
                            "naive TIMESTAMP discards offset and is rarely correct."
                        ),
                    )
                )
        return diags
