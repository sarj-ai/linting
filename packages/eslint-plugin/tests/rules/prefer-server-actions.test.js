const { RuleTester } = require("eslint");
const rule = require("../../lib/rules/prefer-server-actions");

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("prefer-server-actions", rule, {
  valid: [
    // GET is fine — only mutations are flagged
    "fetch('/api/users');",
    "fetch('/api/users', { method: 'GET' });",
    // External URLs are fine
    "fetch('https://api.example.com/users', { method: 'POST' });",
  ],
  invalid: [
    {
      code: "fetch('/api/users', { method: 'POST' });",
      errors: [{ messageId: "preferServerAction" }],
    },
    {
      code: "fetch('/api/users/1', { method: 'DELETE' });",
      errors: [{ messageId: "preferServerAction" }],
    },
    {
      code: "fetch('/api/users/1', { method: 'put' });", // case-insensitive
      errors: [{ messageId: "preferServerAction" }],
    },
    {
      code: "fetch(`/api/literal`, { method: 'PATCH' });",
      errors: [{ messageId: "preferServerAction" }],
    },
    // Patched rule now catches dynamic template literals (a key missing case)
    {
      code: "fetch(`/api/${id}`, { method: 'POST' });",
      errors: [{ messageId: "preferServerAction" }],
    },
  ],
});
