import { ESLintUtils, type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";

type MessageIds = "missingAssertNever";
type Options = readonly [];

const isAssertNeverCall = (expression: TSESTree.Expression): boolean => {
  if (expression.type !== AST_NODE_TYPES.CallExpression) return false;
  const callee = expression.callee;
  return (
    callee.type === AST_NODE_TYPES.Identifier && callee.name === "assertNever"
  );
};

const statementContainsAssertNever = (
  statement: TSESTree.Statement,
): boolean => {
  if (statement.type === AST_NODE_TYPES.ExpressionStatement) {
    return isAssertNeverCall(statement.expression);
  }
  if (statement.type === AST_NODE_TYPES.ThrowStatement) {
    return isAssertNeverCall(statement.argument);
  }
  // Recurse into block-scoped default bodies like `default: { ... }`
  if (statement.type === AST_NODE_TYPES.BlockStatement) {
    return statement.body.some(statementContainsAssertNever);
  }
  return false;
};

export default ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/sarj-ai/linting/blob/main/packages/typescript/src/rules/${name}.ts`,
)<Options, MessageIds>({
  name: "require-assert-never",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require switch statements to end with `assertNever(_)` in their default case so that discriminated unions are exhaustively checked at compile time.",
    },
    schema: [],
    messages: {
      missingAssertNever:
        "Switch statement default case must call assertNever() for exhaustive type checking",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      SwitchStatement(node: TSESTree.SwitchStatement): void {
        const defaultCase = node.cases.find(
          (caseNode): caseNode is TSESTree.SwitchCase => caseNode.test === null,
        );
        if (!defaultCase) return;

        const hasAssertNever = defaultCase.consequent.some(
          statementContainsAssertNever,
        );
        if (hasAssertNever) return;

        context.report({
          node: defaultCase,
          messageId: "missingAssertNever",
        });
      },
    };
  },
});
