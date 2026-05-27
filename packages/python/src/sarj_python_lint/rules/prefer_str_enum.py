"""SARJ006: Pydantic field with raw `str` annotation that looks like a choice/enum field.

`Literal["a", "b", "c"]` is acceptable — that's a proper closed set. This rule
only flags **raw `str`** annotations on fields whose name (`*_status`, `*_state`,
`*_type`, `*_kind`) or sibling class attribute (`choices`, `states`, `STATUSES`,
`values`, `allowed`) strongly suggests a closed enumeration is intended.

Replace with:
    class Status(StrEnum):
        ACTIVE = "active"
        INACTIVE = "inactive"

References:
- https://docs.python.org/3/library/enum.html#enum.StrEnum
- https://docs.pydantic.dev/latest/concepts/types/#enums
"""

from __future__ import annotations

import ast
from pathlib import Path

from sarj_python_lint.rule_base import Diagnostic, Rule


class PreferStrEnum(Rule):
    id = "prefer-str-enum"
    code = "SARJ006"
    description = "Pydantic str field with choice-like default — prefer StrEnum."

    def check(self, path: Path, source: str) -> list[Diagnostic]:
        try:
            tree = ast.parse(source, filename=str(path))
        except SyntaxError:
            return []
        diags: list[Diagnostic] = []
        for cls in ast.walk(tree):
            if not isinstance(cls, ast.ClassDef):
                continue
            # Skip enum classes themselves
            if any(_base_name(b) in {"Enum", "StrEnum", "IntEnum"} for b in cls.bases):
                continue
            # Find string-list class attrs that look like a choices set.
            choices_attrs: set[str] = set()
            for stmt in cls.body:
                if isinstance(stmt, (ast.Assign, ast.AnnAssign)):
                    target = (
                        stmt.targets[0]
                        if isinstance(stmt, ast.Assign) and stmt.targets
                        else getattr(stmt, "target", None)
                    )
                    if not isinstance(target, ast.Name):
                        continue
                    val = getattr(stmt, "value", None)
                    if _is_string_collection(val) and target.id.lower() in {
                        "choices",
                        "states",
                        "statuses",
                        "values",
                        "allowed",
                    }:
                        choices_attrs.add(target.id)
            # Flag bare-str AnnAssigns
            for stmt in cls.body:
                if not isinstance(stmt, ast.AnnAssign):
                    continue
                if not isinstance(stmt.target, ast.Name):
                    continue
                ann_text = ast.unparse(stmt.annotation) if stmt.annotation else ""
                if ann_text.strip() != "str":
                    continue  # Literal[...] etc. is fine per user L234
                # Heuristic: there's a nearby choices list OR the field name
                # ends with `_status` / `_state` / `_type`.
                name = stmt.target.id
                if choices_attrs or name.endswith(("_status", "_state", "_type", "_kind")):
                    diags.append(
                        Diagnostic(
                            path=path,
                            line=stmt.lineno,
                            col=stmt.col_offset + 1,
                            code=self.code,
                            message=(
                                f"`{name}: str` looks like a choice field — "
                                "prefer `StrEnum`. (`Literal[...]` is also acceptable.)"
                            ),
                        )
                    )
        return diags


def _base_name(base: ast.AST) -> str | None:
    if isinstance(base, ast.Name):
        return base.id
    if isinstance(base, ast.Attribute):
        return base.attr
    return None


def _is_string_collection(node: ast.AST | None) -> bool:
    if not isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return False
    return all(
        isinstance(elt, ast.Constant) and isinstance(elt.value, str)
        for elt in node.elts
    )
