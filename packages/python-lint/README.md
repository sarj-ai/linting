# sarj-python-lint

Custom Python + SQL lint rules for hypermodern codebases. AST-based (Python stdlib `ast` for Python rules, [sqlfluff](https://sqlfluff.com) for SQL). Designed for pre-commit.

## Install

```bash
pip install sarj-python-lint
# or via uv:
uv tool install sarj-python-lint
```

## CLI

```bash
sarj-python-lint check --rule no-sequential-await path/to/file.py
sarj-python-lint check --rule enforce-timestamptz svcs/db/db/migrations/*.sql
sarj-python-lint list-rules
```

Diagnostic format is `path:line:col: CODE message` — Ruff-compatible for editor integrations that consume that grammar.

## Pre-commit usage

```yaml
- repo: https://github.com/sarj-ai/linting
  rev: python-lint-v0.1.0
  hooks:
    - id: sarj-no-sequential-await
    - id: sarj-inefficient-string-concat-in-loop
    - id: sarj-prefer-discriminated-union
    - id: sarj-prefer-str-enum
    - id: sarj-enforce-timestamptz
```

(The `.pre-commit-hooks.yaml` manifest lives at `packages/python-lint/.pre-commit-hooks.yaml`. pre-commit picks it up via the `subdir` mechanism.)

## Rules

### Python (4)

| Code | ID | Description |
|---|---|---|
| `SARJ001` | `no-sequential-await` | `for x in xs: await f(x)` — prefer `asyncio.gather`. |
| `SARJ002` | `inefficient-string-concat-in-loop` | `s += "..."` inside loop is O(n²); append to list + `"".join(...)`. |
| `SARJ005` | `prefer-discriminated-union` | `BaseModel` with `success: bool` + Optional fields — use `Union[Success, Error]`. |
| `SARJ006` | `prefer-str-enum` | Pydantic Field with raw `str` and 3+ literal-looking choices — use `StrEnum` (`Literal["a","b"]` allowed). |

### SQL (1)

| Code | ID | Description |
|---|---|---|
| `SARJ101` | `enforce-timestamptz` | `TIMESTAMP` columns in migrations missing `WITH TIME ZONE`. |

## Adding rules

Subclass `sarj_python_lint.rule_base.Rule`. Implement `check(path, source) -> list[Diagnostic]`. Register in `sarj_python_lint.rules.REGISTRY`. Add a hook to `.pre-commit-hooks.yaml`.

## License

MIT.
