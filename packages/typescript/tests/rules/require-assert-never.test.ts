import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

import rule from "../../src/rules/require-assert-never.js";

// Bind vitest to RuleTester for proper test reporting
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester();

ruleTester.run("require-assert-never", rule, {
  valid: [
    // Switch with no default — rule only flags missing assertNever in a present default
    {
      code: `
        switch (kind) {
          case 'a': break;
          case 'b': break;
        }
      `,
    },
    // Default case calls assertNever() as an expression statement
    {
      code: `
        switch (kind) {
          case 'a': break;
          default: assertNever(kind);
        }
      `,
    },
    // Default case throws assertNever()
    {
      code: `
        switch (kind) {
          case 'a': break;
          default: throw assertNever(kind);
        }
      `,
    },
    // Default with multiple statements but at least one assertNever()
    {
      code: `
        switch (kind) {
          case 'a': break;
          default: {
            const _exhaustive = kind;
            assertNever(_exhaustive);
          }
        }
      `,
    },
  ],
  invalid: [
    // Default with no body
    {
      code: `
        switch (kind) {
          case 'a': break;
          default:
        }
      `,
      errors: [{ messageId: "missingAssertNever" }],
    },
    // Default that throws a regular Error
    {
      code: `
        switch (kind) {
          case 'a': break;
          default: throw new Error('unreachable');
        }
      `,
      errors: [{ messageId: "missingAssertNever" }],
    },
    // Default that calls a non-assertNever function
    {
      code: `
        switch (kind) {
          case 'a': break;
          default: logUnknown(kind);
        }
      `,
      errors: [{ messageId: "missingAssertNever" }],
    },
    // Default that just breaks
    {
      code: `
        switch (kind) {
          case 'a': break;
          default: break;
        }
      `,
      errors: [{ messageId: "missingAssertNever" }],
    },
  ],
});
