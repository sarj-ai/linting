# Contributing

1. Fork + branch off `main`.
2. `make build && make test && make typecheck`.
3. Add tests under `packages/<lang>/tests/rules/` for any new rule.
4. Open a PR — CI must be green. New rules need a one-paragraph rationale in the PR body.

Releases are tag-driven (`<pkg>-vX.Y.Z`); maintainers cut tags after merge.
