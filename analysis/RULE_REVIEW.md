# Rule Review — Gemini 3.5 Flash sensibility judge

Reviewed 12 rules against real-codebase hits.

## `no-sequential-await` — **(no parse)** (? total hits)

(no text)


## `inefficient-string-concat-in-loop` — **(no parse)** (? total hits)

(no text)


## `no-in-app-aggregation` — **drop** (1330 total hits)

The rule has an extremely high false-positive risk, flagging standard Python idioms like summing over `dict.items()` and any string containing common words like 'limit' or 'count' (e.g., in gRPC or packaging libraries). Furthermore, banning standard SQL clauses like `LIMIT` or `COUNT` on Postgres is inappropriate for OLTP workloads where they are necessary and efficient.

- false-positive risk: **high**

## `prefer-pydantic-returns` — **drop** (160 total hits)

Forcing Pydantic or dataclasses over standard `TypedDict` and bare collections is extremely opinionated and ignores valid use cases where runtime validation is undesirable due to performance overhead or dependency constraints. Additionally, flagging bare `tuple` returns is highly disruptive for simple utility functions.

- false-positive risk: **high**
- missing cases: Union types containing bare collections (e.g., `dict | None` or `Union[dict, str]`) are not flagged., TypedDict imported under an alias (e.g., `from typing import TypedDict as TD`) is missed.

## `prefer-discriminated-union` — **(no parse)** (? total hits)

(no text)


## `prefer-str-enum` — **(no parse)** (? total hits)

(no text)


## `enforce-timestamptz` — **(no parse)** (? total hits)

(no text)


## `detect-on-conflict-without-unique` — **drop** (5 total hits)

Tracking database schema state across migrations using regex is highly fragile and prone to false positives, especially since standard CI/CD and pre-commit workflows run on individual modified files rather than a concatenated history. Additionally, it cannot account for schemas managed by ORMs (Prisma, SQLAlchemy, Django) or constraints added via `ALTER TABLE` statements.

- false-positive risk: **high**
- missing cases: Schema-qualified table names (e.g., `schema.table`) which break the simple `(\w+)` regex matching, Constraints added or modified via `ALTER TABLE ... ADD CONSTRAINT`, Postgres `ON CONFLICT ON CONSTRAINT constraint_name` syntax which bypasses column lists, Quoted identifiers (e.g., `"userId"`) which affect string matching and normalization, Tables and indexes defined in ORM schemas rather than raw SQL migration files

## `no-client-side-data-fetching` — **drop** (1 total hits)

The rule is too narrow and easily bypassed, as it only catches raw `fetch`/`axios` calls directly inside `useEffect` while missing helper functions defined outside the hook or custom hooks. Additionally, its error message assumes a Next.js App Router environment (RSC/Server Actions) which does not generalize to all React/TS projects, and it flags legitimate client-side operations like analytics/telemetry pings.

- false-positive risk: **medium**
- missing cases: Fetch/axios calls wrapped in helper functions defined outside the useEffect hook, Custom data-fetching hooks (e.g., useFetch, useQuery), Other client-side fetching libraries like ky, superagent, or graphql-request

## `prefer-server-actions` — **refine-pattern** (42 total hits)

The rule has an excellent conceptual goal for Next.js App Router adoption, but its AST matching is too restrictive. It completely misses mutations with dynamic URLs (e.g., `/api/orders/${id}`) because it only evaluates template literals with zero expressions.

- false-positive risk: **low**
- refinement: Update the URL matching logic to support template literals with expressions by checking if the first quasi starts with '/api/'. For example: `if (node.type === 'TemplateLiteral' && node.quasis[0]?.value.cooked.startsWith('/api/')) { ... }`.
- missing cases: Template literals with dynamic expressions (e.g., `/api/orders/${id}`), which are extremely common for PUT and DELETE mutations., Dynamic method definitions (e.g., `const method = isEdit ? 'PUT' : 'POST'`)., Custom fetch wrappers or Axios instances (e.g., `api.post('/api/orders')`).

## `no-unnecessary-use-client` — **(no parse)** (? total hits)

(no text)


## `prefer-schema-for-api-payload` — **refine-pattern** (68 total hits)

The rule uses a single flat Map to track variables globally across the file, ignoring block and function scopes, which will cause collisions and incorrect tracking. Additionally, it misses common patterns like destructuring and direct property access on the await expression.

- false-positive risk: **high**
- refinement: Use ESLint's built-in scope manager (`context.getScope()`) to track variables reliably across scopes instead of a global Map. Expand detection to handle `ObjectPattern` destructuring and direct member access on the await expression itself.
- missing cases: Destructuring assignments: `const { foo } = await response.json()`, Direct property access on the expression: `(await response.json()).foo`, Passing the unvalidated object directly to other functions or returning it: `return await response.json()`, Type assertions like `await response.json() as MyType` which bypass the check
