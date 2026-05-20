module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce Zod schemas to be named with a Z prefix",
      category: "Stylistic Issues",
      recommended: false
    },
    fixable: null,
    schema: []
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        // Check if the right side involves z.object() or other Zod schema creation
        if (
          node.init &&
          node.init.type === "CallExpression" &&
          node.init.callee &&
          (
            // Check direct calls like z.object()
            (node.init.callee.type === "MemberExpression" && 
             node.init.callee.object && 
             node.init.callee.object.name === "z") ||
            // Check chained calls like z.object().extend()
            (node.init.callee.type === "MemberExpression" && 
             node.init.callee.object && 
             node.init.callee.object.callee &&
             node.init.callee.object.callee.object &&
             node.init.callee.object.callee.object.name === "z")
          )
        ) {
          const variableName = node.id.name;
          if (!variableName.startsWith("Z")) {
            context.report({
              node: node.id,
              message: "Zod schema names should start with Z",
            });
          }
        }
      },
    };
  },
};