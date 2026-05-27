"""Base types for sarj-python-lint rules."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

# Suppression syntax. Two forms supported:
#   # sarj-noqa: SARJ001 — reason
#   # sarj-noqa: SARJ001, SARJ002 — reason
# We deliberately do NOT use `# noqa` because ruff aggressively cleans
# unrecognized noqa codes (RUF100/RUF102) even with `external` set, which
# silently breaks suppressions across runs. Distinct prefix = no conflict.
_SARJ_NOQA_RE = re.compile(
    r"#\s*sarj-noqa(?::\s*([A-Za-z0-9_, ]+))?",
    re.IGNORECASE,
)


def is_suppressed(source_lines: list[str], line: int, code: str) -> bool:
    """Return True if the diagnostic's line carries a `# sarj-noqa[: CODE]` comment.

    `line` is 1-based to match Diagnostic.line.
    """
    if line < 1 or line > len(source_lines):
        return False
    text = source_lines[line - 1]
    m = _SARJ_NOQA_RE.search(text)
    if not m:
        return False
    codes_str = m.group(1)
    if not codes_str:
        # Bare `# sarj-noqa` suppresses every SARJ code on the line
        return True
    codes = {c.strip().upper() for c in codes_str.split(",") if c.strip()}
    return code.upper() in codes


@dataclass(frozen=True, slots=True)
class Diagnostic:
    """A single lint finding."""

    path: Path
    line: int
    col: int
    code: str
    message: str

    def format(self) -> str:
        """Ruff-compatible: `path:line:col: CODE message`."""
        return f"{self.path}:{self.line}:{self.col}: {self.code} {self.message}"


class Rule(ABC):
    """Base class for a single lint rule.

    Subclasses set `id` (kebab-case) and `code` (e.g. SARJ001) as class
    attributes and implement `check(path, source) -> list[Diagnostic]`.
    """

    id: str
    code: str
    description: str

    @abstractmethod
    def check(self, path: Path, source: str) -> list[Diagnostic]:
        """Inspect the given source. Return zero or more diagnostics."""
        raise NotImplementedError
