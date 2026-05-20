# @sarj/eslint-plugin

Custom ESLint rules for hypermodern TypeScript / React / Next.js projects.

## Install

```bash
pnpm add -D @sarj/eslint-plugin
# or: npm install --save-dev @sarj/eslint-plugin
```

## Usage (flat config)

```js
import sarj from "@sarj/eslint-plugin";

export default [
  {
    plugins: { "@sarj": sarj },
    rules: {
      // pick what you need, or use a config below
      "@sarj/no-client-side-data-fetching": "error",
      "@sarj/prefer-server-actions": "warn",
      "@sarj/no-unnecessary-use-client": "warn",
      "@sarj/prefer-schema-for-api-payload": "error",
    },
  },
];
```

Or use a preset:

```js
import sarj from "@sarj/eslint-plugin";

export default [
  // recommended: warn-first across most rules
  ...sarj.configs.recommended,
];
```

## Rules

### Foundations
| Rule | Description |
|---|---|
| `@sarj/zod-naming-convention` | Zod schemas must be `Z<Name>` (e.g. `ZUser`). |
| `@sarj/require-assert-never` | `switch` over discriminated union must end with `assertNever(_)`. |
| `@sarj/require-zod-form-validation` | Forms must validate via Zod schemas. |
| `@sarj/enforce-file-structure` | Components / hooks / utils must live in canonical folders. |
| `@sarj/no-raw-env` | Don't read `process.env.*` directly; route through typed config. |
| `@sarj/prefer-shadcn` | Use shadcn/ui primitives instead of raw HTML. |
| `@sarj/no-enum` | TS `enum` is banned; use `as const` objects + string literal types. |

### Next.js / RSC boundary (added in 1.1.0, motivated by lessons from real codebases)
| Rule | Description |
|---|---|
| `@sarj/no-client-side-data-fetching` | No `fetch`/`axios` inside `useEffect`. Move to RSC / Server Action. |
| `@sarj/prefer-server-actions` | Avoid `fetch('/api/*', { method: POST/PUT/DELETE })`. Prefer Server Actions. |
| `@sarj/no-unnecessary-use-client` | `'use client'` files with no hooks / event handlers can be Server Components. |
| `@sarj/prefer-schema-for-api-payload` | Don't access `response.json()` fields without `zodSchema.parse()`. |

## Configs

- `recommended` — warn-first; foundations at error, RSC rules at warn.
- `strict` — every rule at error.
- `style-guide` — formatting/naming-only subset (legacy from sarj-eslint).
