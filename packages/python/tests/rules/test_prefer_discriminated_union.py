from pathlib import Path

from sarj_python_lint.rules.prefer_discriminated_union import PreferDiscriminatedUnion


def _check(source: str) -> list:
    return PreferDiscriminatedUnion().check(Path("<t>.py"), source)


def test_flags_success_with_optional_fields():
    src = """
from pydantic import BaseModel
from typing import Optional

class Result(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None
"""
    assert len(_check(src)) == 1


def test_flags_pipe_optional_syntax():
    src = """
from pydantic import BaseModel

class Result(BaseModel):
    success: bool
    payload: dict | None = None
    error: str | None = None
"""
    assert len(_check(src)) == 1


def test_allows_proper_union():
    src = """
from pydantic import BaseModel
from typing import Union

class Success(BaseModel):
    data: dict

class Failure(BaseModel):
    error: str
"""
    assert _check(src) == []


def test_allows_success_alone():
    src = """
from pydantic import BaseModel

class Heartbeat(BaseModel):
    success: bool
"""
    # Only one bool, no Optional siblings → don't flag
    assert _check(src) == []
