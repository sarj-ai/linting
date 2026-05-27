import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import rule from "../../src/rules/prefer-schema-for-api-payload.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester();

ruleTester.run("prefer-schema-for-api-payload", rule, {
  valid: [
    // No json() involved.
    { code: "const x = { foo: 1 }; doStuff(x.foo);" },
    // Parsed through Zod.
    {
      code: "async function f(r) { const data = ZUser.parse(await r.json()); return data.name; }",
    },
    // safeParse.
    {
      code: "async function f(r) { const data = ZUser.safeParse(await r.json()); }",
    },
    // json() result used as opaque value, never field-accessed.
    {
      code: "async function f(r) { const data = await r.json(); return data; }",
    },
    // Direct `.parse()` chained off `.json()` is fine.
    {
      code: "async function f(r) { return ZUser.parse(await r.json()); }",
    },
  ],
  invalid: [
    {
      code: "async function f(r) { const data = await r.json(); return data.name; }",
      errors: [{ messageId: "unparsedJsonAccess" }],
    },
    {
      code: "async function f(r) { const payload = await r.json(); console.log(payload.id); }",
      errors: [{ messageId: "unparsedJsonAccess" }],
    },
    // Destructuring directly off a json() call.
    {
      code: "async function f(r) { const { name } = await r.json(); return name; }",
      errors: [{ messageId: "unparsedJsonAccess" }],
    },
  ],
});
