const { RuleTester } = require("eslint");
const rule = require("../../lib/rules/prefer-schema-for-api-payload");

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("prefer-schema-for-api-payload", rule, {
  valid: [
    // No json() involved
    "const x = { foo: 1 }; doStuff(x.foo);",
    // Parsed through Zod
    "async function f(r) { const data = ZUser.parse(await r.json()); return data.name; }",
    // safeParse
    "async function f(r) { const data = ZUser.safeParse(await r.json()); }",
    // json() used but not destructured for member access
    "async function f(r) { const data = await r.json(); return data; }",
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
  ],
});
