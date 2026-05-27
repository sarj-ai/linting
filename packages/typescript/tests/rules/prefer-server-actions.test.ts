import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import rule from "../../src/rules/prefer-server-actions.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester();

ruleTester.run("prefer-server-actions", rule, {
  valid: [
    // GET is fine — only mutations are flagged.
    { code: "fetch('/api/users');" },
    { code: "fetch('/api/users', { method: 'GET' });" },
    // External URLs are fine.
    { code: "fetch('https://api.example.com/users', { method: 'POST' });" },
    // Mutation against a non-/api URL is fine.
    { code: "fetch('/other/users', { method: 'POST' });" },
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
      // Method casing is normalized.
      code: "fetch('/api/users/1', { method: 'put' });",
      errors: [{ messageId: "preferServerAction" }],
    },
    {
      code: "fetch(`/api/literal`, { method: 'PATCH' });",
      errors: [{ messageId: "preferServerAction" }],
    },
    {
      // Dynamic template literal with `/api/` prefix.
      code: "fetch(`/api/${id}`, { method: 'POST' });",
      errors: [{ messageId: "preferServerAction" }],
    },
  ],
});
