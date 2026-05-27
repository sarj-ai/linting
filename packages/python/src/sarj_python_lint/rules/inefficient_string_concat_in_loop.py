"""SARJ002: detect `s += "..."` inside loops.

String concatenation with `+=` inside a loop is O(n²) in CPython because
strings are immutable — each `+=` allocates a new string and copies the
previous one. Append to a list and `"".join(parts)` at the end for O(n).

References:
- https://docs.python.org/3/library/stdtypes.html#str.join
- https://wiki.python.org/moin/PythonSpeed/PerformanceTips
"""

from __future__ import annotations

import ast
from pathlib import Path

from sarj_python_lint.rule_base import Diagnostic, Rule


class InefficientStringConcatInLoop(Rule):
    """O(n²) string concatenation in a loop."""

    id = "inefficient-string-concat-in-loop"
    code = "SARJ002"
    description = "`s += '...'` in a loop is O(n²); append to a list and join."

    def check(self, path: Path, source: str) -> list[Diagnostic]:
        try:
            tree = ast.parse(source, filename=str(path))
        except SyntaxError:
            return []
        diags: list[Diagnostic] = []
        for loop in ast.walk(tree):
            if not isinstance(loop, (ast.For, ast.While)):
                continue
            for node in ast.walk(loop):
                if not isinstance(node, ast.AugAssign):
                    continue
                if not isinstance(node.op, ast.Add):
                    continue
                # Heuristic: the RHS is a string-like value
                if not _looks_like_string(node.value):
                    continue
                diags.append(
                    Diagnostic(
                        path=path,
                        line=node.lineno,
                        col=node.col_offset + 1,
                        code=self.code,
                        message=(
                            "`+=` string concat in a loop is O(n²). "
                            "Append to a list and `''.join(...)`."
                        ),
                    )
                )
        return diags


def _looks_like_string(node: ast.AST) -> bool:
    """Heuristic for 'this RHS is probably a string at runtime'."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return True
    if isinstance(node, ast.JoinedStr):  # f-string
        return True
    if isinstance(node, ast.Call):
        # str(...) / repr(...) / format / strftime — usually string
        if isinstance(node.func, ast.Name) and node.func.id in {"str", "repr", "format"}:
            return True
        if isinstance(node.func, ast.Attribute):
            return node.func.attr in {"format", "strftime", "join"}
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        # `+` propagates string-ness if either side is a string
        return _looks_like_string(node.left) or _looks_like_string(node.right)
    return False
