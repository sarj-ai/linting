# sarj-ai/linting

Cross-language lint rules for hypermodern TypeScript + Python codebases. Two packages, one source of truth.

| Package | Tool | Registry | Purpose | Rules |
|---|---|---|---|---|
| [`@sarj/eslint-plugin`](packages/eslint-plugin/) | ESLint | [npm](https://www.npmjs.com/package/@sarj/eslint-plugin) | Custom TS/JS/React rules | 11 |
| [`sarj-python-lint`](packages/python-lint/) | pre-commit | [PyPI](https://pypi.org/project/sarj-python-lint/) | Custom Python AST + SQL rules | 5 |

Each new rule was validated against ~10 real codebases and reviewed by an LLM
sensibility judge before publication; rules that produced too many false
positives or were too opinionated were dropped or refined.

## Why a monorepo?

- One issue tracker, one PR per cross-language rule pair.
- Per-package CI, per-package versioning (`eslint-plugin-vX.Y.Z`, `python-lint-vX.Y.Z` tags).
- Downstream consumers share a single upstream for both ESLint + pre-commit hooks.

## Adding a new rule

- **TypeScript/React/JSX** → `packages/eslint-plugin/lib/rules/<kebab-name>.js` + test in `tests/rules/<kebab-name>.test.js`. Bump `package.json` minor and re-publish.
- **Python or SQL** → `packages/python-lint/src/sarj_python_lint/rules/<snake_name>.py` + test in `tests/rules/test_<snake_name>.py`. Bump `pyproject.toml` minor, tag, and re-publish.

Each rule must have:
- A clear name (verb-prefix preferred: `no-*`, `prefer-*`, `enforce-*`, `require-*`).
- A docstring/JSDoc describing the anti-pattern, the recommended fix, and (where helpful) a public reference URL (e.g. linter docs, Next.js docs).
- Tests covering both positive (rule fires) and negative (rule does not fire) cases.
- A `meta` block (ESLint) or `code:` attribute (Python) with a stable error code.

## License

MIT.
