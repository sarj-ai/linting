import { ESLintUtils, type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";

type MessageIds = "missingZodValidation";
type Options = readonly [];

const isFormDataGetCall = (node: TSESTree.CallExpression): boolean => {
  const callee = node.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  if (
    callee.property.type !== AST_NODE_TYPES.Identifier ||
    callee.property.name !== "get"
  ) {
    return false;
  }
  // Match `formData.get(...)` specifically — same convention as the original rule.
  return (
    callee.object.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === "formData"
  );
};

const isParseCallExpression = (node: TSESTree.Node): boolean => {
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  const callee = node.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  return (
    callee.property.type === AST_NODE_TYPES.Identifier &&
    callee.property.name === "parse"
  );
};

export default ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/sarj-ai/linting/blob/main/packages/typescript/src/rules/${name}.ts`,
)<Options, MessageIds>({
  name: "require-zod-form-validation",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Zod validation (`Schema.parse(...)`) when reading values out of a `FormData` object.",
    },
    schema: [],
    messages: {
      missingZodValidation:
        "FormData parsing must use Zod schema validation (e.g., Schema.parse())",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression): void {
        if (!isFormDataGetCall(node)) return;

        // Walk up the parent chain to find a surrounding `.parse(...)` call.
        // `.parent` is `null` at the Program root, so we must guard for both
        // null and undefined.
        let parent: TSESTree.Node | null | undefined = node.parent;
        while (parent !== null && parent !== undefined) {
          if (isParseCallExpression(parent)) return;
          parent = parent.parent;
        }

        context.report({
          node,
          messageId: "missingZodValidation",
        });
      },
    };
  },
});
