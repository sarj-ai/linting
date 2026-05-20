/**
 * @fileoverview Disallow direct process.env access
 * @description Use Zod-validated env schema instead of process.env
 */

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow direct process.env access",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
    messages: {
      noRawEnv: "Use Zod-validated env schema instead of process.env directly",
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.object.type === "Identifier" &&
          node.object.name === "process" &&
          node.property.type === "Identifier" &&
          node.property.name === "env"
        ) {
          context.report({
            node,
            messageId: "noRawEnv",
          });
        }
      },
    };
  },
};
