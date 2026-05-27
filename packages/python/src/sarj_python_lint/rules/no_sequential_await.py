"""SARJ001: detect `for x in xs: await f(x)` patterns.

Sequential `await` in a for-loop serializes I/O that could be parallelized
with `asyncio.gather([f(x) for x in xs])`. The performance gap is often 10-100x
for network-bound work (HTTP, DB queries, LLM calls).

References:
- https://docs.python.org/3/library/asyncio-task.html#running-tasks-concurrently
"""

from __future__ import annotations

import ast
from pathlib import Path

from sarj_python_lint.rule_base import Diagnostic, Rule


class NoSequentialAwait(Rule):
    """Sequential await calls in a loop that could be parallelized."""

    id = "no-sequential-await"
    code = "SARJ001"
    description = "Sequential `await` in a for-loop — prefer asyncio.gather."

    def check(self, path: Path, source: str) -> list[Diagnostic]:
        try:
            tree = ast.parse(source, filename=str(path))
        except SyntaxError:
            return []
        diags: list[Diagnostic] = []
        for node in ast.walk(tree):
            if not isinstance(node, ast.For):
                continue
            # `async for` is fine — that's the parallel-iteration construct
            for child in ast.walk(node):
                # Skip nested For loops to avoid double-reporting the outer one
                if isinstance(child, ast.Await) and _enclosing_loop(child, tree) is node:
                    diags.append(
                        Diagnostic(
                            path=path,
                            line=child.lineno,
                            col=child.col_offset + 1,
                            code=self.code,
                            message=(
                                "Sequential `await` inside `for` — prefer "
                                "`asyncio.gather([f(x) for x in xs])`."
                            ),
                        )
                    )
                    break  # one diag per for-loop
        return diags


def _enclosing_loop(node: ast.AST, root: ast.AST) -> ast.AST | None:
    """Walk parents until we find the nearest enclosing `ast.For`."""
    # Build a child→parent map lazily on the first call. ast doesn't track
    # parents, so we walk the whole tree once per check.
    parent: dict[int, ast.AST] = {}
    for child in ast.walk(root):
        for grandchild in ast.iter_child_nodes(child):
            parent[id(grandchild)] = child
    cur: ast.AST | None = node
    while cur is not None:
        cur = parent.get(id(cur))
        if isinstance(cur, ast.For):
            return cur
        if isinstance(cur, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            # Don't escape function boundaries
            return None
    return None
