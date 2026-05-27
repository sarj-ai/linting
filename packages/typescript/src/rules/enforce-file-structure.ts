import { ESLintUtils, type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";

type MessageIds = "incorrectOrder" | "useServerDirective";
type Options = readonly [];

/** Section ordinals — lower numbers must appear before higher numbers. */
const SECTION = {
  imports: 0,
  types: 1,
  constants: 2,
  functions: 3,
  exports: 4,
} as const;

const SECTION_NAMES = [
  "imports",
  "types",
  "constants",
  "functions",
  "exports",
] as const;

type SectionOrdinal = (typeof SECTION)[keyof typeof SECTION];

const sectionName = (ordinal: SectionOrdinal): string => {
  const name = SECTION_NAMES[ordinal];
  // SECTION_NAMES is indexed by SectionOrdinal which is a numeric literal union of 0..4 — this is always defined.
  // But noUncheckedIndexedAccess widens this to `string | undefined`, so we fall back defensively.
  return name ?? "unknown";
};

const isConstantNamed = (declarator: TSESTree.VariableDeclarator): boolean => {
  if (declarator.id.type !== AST_NODE_TYPES.Identifier) return false;
  const name = declarator.id.name;
  // Treat as constant if the binding is ALL_CAPS (allowing underscores/digits).
  return name.length > 0 && name === name.toUpperCase();
};

const getStatementSection = (
  statement: TSESTree.ProgramStatement,
): SectionOrdinal => {
  switch (statement.type) {
    case AST_NODE_TYPES.ImportDeclaration:
      return SECTION.imports;
    case AST_NODE_TYPES.TSTypeAliasDeclaration:
    case AST_NODE_TYPES.TSInterfaceDeclaration:
    case AST_NODE_TYPES.TSEnumDeclaration:
      return SECTION.types;
    case AST_NODE_TYPES.VariableDeclaration: {
      if (statement.kind === "const") {
        const firstDeclarator = statement.declarations[0];
        if (firstDeclarator !== undefined && isConstantNamed(firstDeclarator)) {
          return SECTION.constants;
        }
      }
      return SECTION.functions;
    }
    case AST_NODE_TYPES.FunctionDeclaration:
      return SECTION.functions;
    case AST_NODE_TYPES.ExportNamedDeclaration:
    case AST_NODE_TYPES.ExportDefaultDeclaration:
    case AST_NODE_TYPES.ExportAllDeclaration:
      return SECTION.exports;
    default:
      return SECTION.functions;
  }
};

const isUseServerDirective = (
  statement: TSESTree.ProgramStatement | undefined,
): boolean => {
  if (statement === undefined) return false;
  if (statement.type !== AST_NODE_TYPES.ExpressionStatement) return false;
  const expr = statement.expression;
  if (expr.type !== AST_NODE_TYPES.Literal) return false;
  return expr.value === "use server";
};

export default ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/sarj-ai/linting/blob/main/packages/typescript/src/rules/${name}.ts`,
)<Options, MessageIds>({
  name: "enforce-file-structure",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce a canonical top-of-file ordering: imports -> types -> constants -> functions -> exports. Server-action files (under `/actions/` or with `action` in the path) must also begin with a `use server` directive.",
    },
    schema: [],
    messages: {
      incorrectOrder:
        "File structure violation: {{current}} should come before {{expected}}",
      useServerDirective:
        "Server action files must start with 'use server' directive",
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;
    const isServerAction =
      filename.includes("/actions/") || filename.includes("action");

    return {
      Program(node: TSESTree.Program): void {
        const body = node.body;

        if (isServerAction) {
          const firstNode = body[0];
          if (!isUseServerDirective(firstNode)) {
            context.report({
              node,
              messageId: "useServerDirective",
            });
          }
        }

        let currentSection: SectionOrdinal = SECTION.imports;

        for (const statement of body) {
          // Skip top-of-file string directives ('use server', 'use client',
          // 'use strict', ...) so they don't get classified as a section.
          if (isUseServerDirective(statement)) continue;
          if (
            statement.type === AST_NODE_TYPES.ExpressionStatement &&
            statement.expression.type === AST_NODE_TYPES.Literal &&
            typeof statement.expression.value === "string" &&
            statement.expression.value.startsWith("use ")
          ) {
            continue;
          }

          const statementSection = getStatementSection(statement);

          if (statementSection < currentSection) {
            context.report({
              node: statement,
              messageId: "incorrectOrder",
              data: {
                current: sectionName(statementSection),
                expected: sectionName(currentSection),
              },
            });
          } else if (statementSection > currentSection) {
            currentSection = statementSection;
          }
        }
      },
    };
  },
});
