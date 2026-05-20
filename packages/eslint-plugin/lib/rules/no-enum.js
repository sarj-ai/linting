/**
 * @fileoverview Disallow TypeScript enums, prefer union types
 * @description Enums add runtime code and have unintuitive behavior. Use union types instead.
 */

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow TypeScript enums, prefer union types or const objects",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
    messages: {
      noEnum:
        "Enums are discouraged. Use union types ('type Status = \"active\" | \"inactive\"') or const objects instead.",
    },
  },
  create(context) {
    return {
      TSEnumDeclaration(node) {
        context.report({
          node,
          messageId: "noEnum",
        });
      },
    };
  },
};
