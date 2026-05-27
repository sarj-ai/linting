from pathlib import Path

from sarj_python_lint.rules.prefer_str_enum import PreferStrEnum


def _check(source: str) -> list:
    return PreferStrEnum().check(Path("<t>.py"), source)


def test_flags_choice_attr_with_str_field():
    src = """
from pydantic import BaseModel

class Order(BaseModel):
    statuses = ("pending", "shipped", "delivered")
    status: str = "pending"
"""
    assert len(_check(src)) == 1


def test_flags_status_suffix_name():
    src = """
from pydantic import BaseModel

class Order(BaseModel):
    payment_status: str
"""
    assert len(_check(src)) == 1


def test_allows_literal_type():
    """Per user L234: Literal[...] is acceptable."""
    src = """
from pydantic import BaseModel
from typing import Literal

class Order(BaseModel):
    status: Literal["pending", "shipped", "delivered"]
"""
    assert _check(src) == []


def test_allows_str_for_free_text_field():
    src = """
from pydantic import BaseModel

class User(BaseModel):
    name: str
    email: str
"""
    assert _check(src) == []


def test_does_not_flag_enum_class():
    src = """
from enum import StrEnum

class Status(StrEnum):
    pending = "pending"
"""
    assert _check(src) == []
