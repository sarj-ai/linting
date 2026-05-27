from __future__ import annotations

from sarj_sql_lint.rule_base import Rule
from sarj_sql_lint.rules.enforce_timestamptz import EnforceTimestamptz


REGISTRY: dict[str, type[Rule]] = {
    EnforceTimestamptz.id: EnforceTimestamptz,
}

__all__ = ["REGISTRY"]
