# Rule Refinement — Gemini 3.5 Flash deeper pass

For rules with `drop` / `refine-pattern` / `ship-as-warn` verdicts, Gemini was asked to propose concrete code-level improvements. Patches below ship verbatim into the rule sources if `action=patch-source`.

## `no-sequential-await` — first-pass: **refine-pattern** (270 total hits)

_The rule has a severe performance bottleneck because it rebuilds the AST parent map on every `_enclosing_loop` call, leading to $O(N^2)$ complexity. Additionally, sequential awaits are often intentional for rate-limiting, database transactions, or queue processing, leading to high false-positive rates._

### Refinement → **action: `?`**, final severity: `?`

(no summary)


---

## `inefficient-string-concat-in-loop` — first-pass: **refine-pattern** (208 total hits)

_The current implementation uses `ast.walk` on nested loops, which causes duplicate diagnostics for the same `+=` statement. It also incorrectly flags `+=` inside nested functions or classes defined within a loop, and misses standard `s = s + '...'` re-assignments._

### Refinement → **action: `?`**, final severity: `?`

(no summary)


---

## `no-in-app-aggregation` — first-pass: **drop** (1330 total hits)

_The rule has an extremely high false-positive risk, flagging standard Python idioms like summing over `dict.items()` and any string containing common words like 'limit' or 'count' (e.g., in gRPC or packaging libraries). Furthermore, banning standard SQL clauses like `LIMIT` or `COUNT` on Postgres is inappropriate for OLTP workloads where they are necessary and efficient._

### Refinement → **action: `confirm-drop`**, final severity: `drop`

The rule's core heuristics are fundamentally flawed: banning standard SQL clauses like LIMIT, OFFSET, and COUNT is inappropriate for OLTP databases, and flagging in-app aggregation over variables like 'rows' or 'results' triggers high false positives on standard Python code where data is already in memory and summing/counting is efficient and necessary.


---

## `prefer-pydantic-returns` — first-pass: **drop** (160 total hits)

_Forcing Pydantic or dataclasses over standard `TypedDict` and bare collections is extremely opinionated and ignores valid use cases where runtime validation is undesirable due to performance overhead or dependency constraints. Additionally, flagging bare `tuple` returns is highly disruptive for simple utility functions._

### Refinement → **action: `confirm-drop`**, final severity: `drop`

The rule is overly opinionated, assumes a dependency on Pydantic, and flags standard Python type-hinting mechanisms like TypedDict and bare tuples which are widely used and valid. It has an extremely high false-positive rate and is not suitable for a general-purpose public linter.


---

## `prefer-discriminated-union` — first-pass: **ship-as-warn** (9 total hits)

_The rule targets a very common and high-value API design smell (illegal states in response models). However, it should be a warning rather than an error because some optional fields (e.g., `metadata`, `debug_logs`) are legitimately optional in both success and failure states, and the AST parsing has minor gaps with nested unions._

### Refinement → **action: `patch-source`**, final severity: `warn`

Improved optional type detection to support nested unions, string-literal forward references, and various typing import styles. Added an ignored list of common metadata/debug fields to significantly reduce false positives.

- remaining risks: Minor risk of missing optional fields defined via custom type aliases outside the file, or false positives if custom fields not in the ignore list are legitimately optional in both success and failure states.
- new source: 4,916 chars (saved to `analysis/patches/prefer-discriminated-union.txt`)

---

## `prefer-str-enum` — first-pass: **refine-pattern** (53 total hits)

_The rule flags fields in any class rather than restricting to Pydantic models as described, leading to false positives on standard classes and open-ended fields like `mime_type` or `content_type`. Additionally, the `_type` suffix is too broad and often represents arbitrary strings rather than closed enums._

### Refinement → **action: `?`**, final severity: `?`

(no summary)


---

## `enforce-timestamptz` — first-pass: **refine-pattern** (17 total hits)

_The rule triggers false positives on ClickHouse migrations (which do not support TIMESTAMPTZ) and incorrectly flags valid Postgres types with precision, such as `TIMESTAMP(6) WITH TIME ZONE`, because the negative lookahead fails to account for the precision parentheses._

### Refinement → **action: `?`**, final severity: `?`

(no summary)


---

## `detect-on-conflict-without-unique` — first-pass: **drop** (5 total hits)

_Tracking database schema state across migrations using regex is highly fragile and prone to false positives, especially since standard CI/CD and pre-commit workflows run on individual modified files rather than a concatenated history. Additionally, it cannot account for schemas managed by ORMs (Prisma, SQLAlchemy, Django) or constraints added via `ALTER TABLE` statements._

### Refinement → **action: `confirm-drop`**, final severity: `drop`

Confirming drop. Tracking database schema state across migrations via regex is fundamentally unreliable and guaranteed to produce false positives in standard pre-commit/CI workflows that run on individual modified files, as well as failing to handle ORM-managed schemas, ALTER TABLE statements, and complex SQL syntax.


---

## `no-client-side-data-fetching` — first-pass: **drop** (1 total hits)

_The rule is too narrow and easily bypassed, as it only catches raw `fetch`/`axios` calls directly inside `useEffect` while missing helper functions defined outside the hook or custom hooks. Additionally, its error message assumes a Next.js App Router environment (RSC/Server Actions) which does not generalize to all React/TS projects, and it flags legitimate client-side operations like analytics/telemetry pings._

### Refinement → **action: `patch-source`**, final severity: `warn`

Rewrote the rule to support React.useEffect, ky, and superagent, while ignoring non-GET requests and analytics/telemetry pings to eliminate false positives. Updated the error message to suggest client-side caching libraries (SWR/React Query) as general alternatives alongside Server Components.

- remaining risks: Slight risk of missing data fetching wrapped in custom helper functions defined outside the useEffect hook, or false positives if a custom GET request is named fetch but does not perform data fetching.
- new source: 4,954 chars (saved to `analysis/patches/no-client-side-data-fetching.txt`)

---

## `prefer-server-actions` — first-pass: **refine-pattern** (42 total hits)

_The rule has an excellent conceptual goal for Next.js App Router adoption, but its AST matching is too restrictive. It completely misses mutations with dynamic URLs (e.g., `/api/orders/${id}`) because it only evaluates template literals with zero expressions._

### Refinement → **action: `patch-source`**, final severity: `warn`

Refactored the rule to resolve variables in scope, support template literals with dynamic expressions, handle dynamic method definitions (ternaries/logical OR), and support custom fetch wrappers/Axios instances (e.g., `api.post` or `axios.put`).

- remaining risks: Low risk of false positives if a custom wrapper or Axios instance is used to call an external API that happens to have a path starting with `/api/`.
- new source: 5,734 chars (saved to `analysis/patches/prefer-server-actions.txt`)

---

## `no-unnecessary-use-client` — first-pass: **refine-pattern** (430 total hits)

_The rule has a high risk of false positives because it flags files that define React Context (via `createContext`), use the React 19 `use` hook, or reference browser-only globals like `window`. Additionally, many third-party UI libraries (like Radix UI used in shadcn/ui) do not ship with 'use client' directives, requiring wrapper files to retain the directive to avoid Next.js build/runtime errors._

### Refinement → **action: `patch-source`**, final severity: `warn`

Added robust detection for React 19 `use` hook, `createContext`, browser globals (with scope-aware resolution), client-only third-party imports, class components, and re-exports. Also skipped Next.js error boundary files (`error.tsx`/`global-error.tsx`) to eliminate false positives.

- remaining risks: Extremely low. Some custom local client-only packages or rare browser globals might not be matched, but the rule remains highly conservative and safe to run as a warning.
- new source: 6,021 chars (saved to `analysis/patches/no-unnecessary-use-client.txt`)

---

## `prefer-schema-for-api-payload` — first-pass: **refine-pattern** (68 total hits)

_The rule uses a single flat Map to track variables globally across the file, ignoring block and function scopes, which will cause collisions and incorrect tracking. Additionally, it misses common patterns like destructuring and direct property access on the await expression._

### Refinement → **action: `patch-source`**, final severity: `error`

Refactored the rule to use ESLint's scope manager to track variables safely across scopes, preventing collisions. Added support for destructuring, direct property access on the JSON call, optional chaining, and TypeScript type assertions (as, satisfies, non-null, etc.).

- remaining risks: Extremely low false-positive risk. The rule now only flags direct property access or destructuring on unvalidated payloads, while safely ignoring cases where the payload is passed to other functions or returned from wrapper functions.
- new source: 5,316 chars (saved to `analysis/patches/prefer-schema-for-api-payload.txt`)

---
