"""Base types for sarj-python-lint rules."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


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
