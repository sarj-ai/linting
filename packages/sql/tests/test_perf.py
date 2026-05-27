"""Performance regression tests — each rule must stay under 50 ms / 1k LOC."""
from __future__ import annotations

from pathlib import Path

import pytest

from sarj_sql_lint.rules import REGISTRY


SYNTHETIC_SQL_500 = "\n".join(
    f"CREATE TABLE t_{i} (\n"
    f"    id BIGSERIAL PRIMARY KEY,\n"
    f"    name TEXT NOT NULL,\n"
    f"    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n"
    f"    updated_at TIMESTAMP NOT NULL DEFAULT now()\n"
    f");\n"
    for i in range(100)
)


@pytest.mark.parametrize("rule_id", sorted(REGISTRY))
def test_rule_perf_under_50ms_per_1kloc(benchmark, rule_id: str) -> None:
    rule = REGISTRY[rule_id]()
    path = Path("synthetic.sql")
    benchmark(rule.check, path, SYNTHETIC_SQL_500)
