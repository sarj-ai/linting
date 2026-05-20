module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Require assertNever in switch statement default cases for exhaustive checking",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
    messages: {
      missingAssertNever: "Switch statement default case must call assertNever() for exhaustive type checking"
    }
  },
  create(context) {
    return {
      SwitchStatement(node) {
        const defaultCase = node.cases.find(caseNode => caseNode.test === null);

        if (defaultCase) {
          const hasAssertNever = defaultCase.consequent.some(statement => {
            // Check for ExpressionStatement containing CallExpression
            if (statement.type === 'ExpressionStatement' &&
                statement.expression.type === 'CallExpression') {
              const callee = statement.expression.callee;
              return callee.name === 'assertNever';
            }
            // Check for ThrowStatement with assertNever call
            if (statement.type === 'ThrowStatement' &&
                statement.argument.type === 'CallExpression') {
              const callee = statement.argument.callee;
              return callee.name === 'assertNever';
            }
            return false;
          });

          if (!hasAssertNever) {
            context.report({
              node: defaultCase,
              messageId: "missingAssertNever"
            });
          }
        }
      }
    };
  }
};