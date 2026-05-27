# @sarj/lint-configs

Maximally-strict ESLint flat-config preset for sarj-ai TypeScript projects.

```bash
pnpm add -D @sarj/lint-configs
```

```js
// eslint.config.mjs
import strict from "@sarj/lint-configs";
export default [...strict, { /* repo-specific overrides */ }];
```

Peer dependencies (your project's `devDependencies`):

```jsonc
{
  "devDependencies": {
    "@eslint-community/eslint-plugin-eslint-comments": "^4",
    "@sarj/eslint-plugin": "^2",
    "eslint": "^9",
    "eslint-plugin-react": "^7",
    "eslint-plugin-react-hooks": "^5",
    "eslint-plugin-unicorn": "^57",
    "eslint-plugin-zod": "^1",
    "typescript-eslint": "^8"
  }
}
```

The actual config is at `eslint.strict.mjs` — read it for the rule list. It enables `tseslint.configs.strictTypeChecked` plus 21 Tier-1+Tier-2 rules surfaced by the v2 review-mining pipeline.

## Companion packages

- `sarj-lint-configs` on PyPI — same configs available as `.toml` files for ruff/pyright via a `sync` CLI.
