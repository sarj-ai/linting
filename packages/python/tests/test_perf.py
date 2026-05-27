"""Performance regression tests — each rule must stay under 50 ms / 1k LOC."""
from __future__ import annotations

from pathlib import Path

import pytest

from sarj_python_lint.rules import REGISTRY


SYNTHETIC_PY_500 = "\n".join(
    f"async def fn_{i}(xs: list[int]) -> int:\n"
    f"    total = 0\n"
    f"    for x in xs:\n"
    f"        v = await fetch(x)\n"
    f"        total += 1\n"
    f"    return total\n"
    for i in range(50)
)


@pytest.mark.parametrize("rule_id", sorted(REGISTRY))
def test_rule_perf_under_50ms_per_1kloc(benchmark, rule_id: str) -> None:
    rule = REGISTRY[rule_id]()
    path = Path("synthetic.py")
    benchmark(rule.check, path, SYNTHETIC_PY_500)
