module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Require Zod validation when parsing FormData",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
    messages: {
      missingZodValidation: "FormData parsing must use Zod schema validation (e.g., Schema.parse())"
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        // Check for formData.get() calls
        if (node.callee.type === 'MemberExpression' &&
            node.callee.property.name === 'get' &&
            node.callee.object.name === 'formData') {

          // Check if this is inside a Zod .parse() call
          let parent = node.parent;
          let hasZodValidation = false;

          // Traverse up to find if we're inside a .parse() call
          while (parent) {
            if (parent.type === 'CallExpression' &&
                parent.callee.type === 'MemberExpression' &&
                parent.callee.property.name === 'parse') {
              hasZodValidation = true;
              break;
            }
            parent = parent.parent;
          }

          if (!hasZodValidation) {
            context.report({
              node,
              messageId: "missingZodValidation"
            });
          }
        }
      }
    };
  }
};