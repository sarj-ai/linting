from pathlib import Path

from sarj_sql_lint.rules.enforce_timestamptz import EnforceTimestamptz


def _check(source: str) -> list:
    return EnforceTimestamptz().check(Path("migration.sql"), source)


def test_flags_naive_timestamp():
    src = """
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL
);
"""
    assert len(_check(src)) == 1


def test_allows_timestamp_with_time_zone():
    src = """
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
"""
    assert _check(src) == []


def test_allows_timestamptz_keyword():
    src = """
CREATE TABLE orders (
    created_at TIMESTAMPTZ NOT NULL
);
"""
    assert _check(src) == []


def test_skips_comment_lines():
    src = """
-- TIMESTAMP without WITH TIME ZONE is forbidden in our docs comments
CREATE TABLE x (created_at TIMESTAMPTZ);
"""
    assert _check(src) == []
