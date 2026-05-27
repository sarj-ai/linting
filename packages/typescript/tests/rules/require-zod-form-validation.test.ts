import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import rule from "../../src/rules/require-zod-form-validation.js";

// Bind vitest to RuleTester for proper test reporting
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester();

ruleTester.run("require-zod-form-validation", rule, {
  valid: [
    // formData.get() wrapped in a Zod schema .parse() call
    {
      code: "const name = ZUser.parse({ name: formData.get('name') });",
    },
    // Nested: .parse() ancestor exists somewhere above
    {
      code: "const result = ZUser.parse({ inner: { name: formData.get('name') } });",
    },
    // Reading from a different identifier — rule is intentionally scoped to `formData`
    {
      code: "const name = req.body.get('name');",
    },
    // Non-`.get()` member call on formData — rule only targets `.get(...)`
    {
      code: "for (const key of formData.keys()) {}",
    },
    // .parse() ancestor at the top level expression
    {
      code: "ZForm.parse(Object.fromEntries([['name', formData.get('name')]]));",
    },
  ],
  invalid: [
    // Bare formData.get() with no Zod validation
    {
      code: "const name = formData.get('name');",
      errors: [{ messageId: "missingZodValidation" }],
    },
    // formData.get() inside an unrelated function call
    {
      code: "console.log(formData.get('name'));",
      errors: [{ messageId: "missingZodValidation" }],
    },
    // formData.get() passed into a non-parse method
    {
      code: "ZUser.safeParse(formData.get('name'));",
      errors: [{ messageId: "missingZodValidation" }],
    },
    // Multiple unvalidated reads — each is flagged
    {
      code: "const a = formData.get('a'); const b = formData.get('b');",
      errors: [
        { messageId: "missingZodValidation" },
        { messageId: "missingZodValidation" },
      ],
    },
  ],
});
