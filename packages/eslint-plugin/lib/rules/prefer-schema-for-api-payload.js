/**
 * @fileoverview Don't access `response.json()` fields without a Zod parse first.
 *
 * Pattern flagged:
 *   const data = await response.json();
 *   doSomething(data.foo);  // <-- unvalidated property access
 *
 * Encouraged:
 *   const data = MySchema.parse(await response.json());
 *   doSomething(data.foo);  // typed + validated
 *
 * Heuristic:
 *   - Track variables initialized to `await someCall.json()` using ESLint's scope manager.
 *   - Untrack if reassigned to anything other than another raw `json()` call.
 *   - Flag MemberExpression reads and destructuring off tracked variables.
 *
 * References:
 *   - https://zod.dev/?id=parse
 *   - https://www.totaltypescript.com/parse-don-t-validate
 */

function unwrap(node) {
  while (node) {
    if (
      node.type === "TSAsExpression" ||
      node.type === "TSTypeAssertion" ||
      node.type === "TSNonNullExpression" ||
      node.type === "TSSatisfiesExpression"
    ) {
      node = node.expression;
    } else if (node.type === "ParenthesizedExpression") {
      node = node.expression;
    } else if (node.type === "ChainExpression") {
      node = node.expression;
    } else {
      break;
    }
  }
  return node;
}

function isJsonCall(node) {
  node = unwrap(node);
  if (!node) return false;
  if (node.type === "AwaitExpression") {
    node = unwrap(node.argument);
  }
  if (!node || node.type !== "CallExpression") return false;
  const callee = unwrap(node.callee);
  if (!callee || callee.type !== "MemberExpression") return false;
  const property = unwrap(callee.property);
  return (
    property &&
    property.type === "Identifier" &&
    property.name === "json"
  );
}

function findVariable(scope, name) {
  while (scope) {
    const variable = scope.set.get(name);
    if (variable) return variable;
    scope = scope.upper;
  }
  return null;
}

function isUnvalidatedVariable(node, scope, unvalidatedVariables) {
  const unwrapped = unwrap(node);
  if (!unwrapped || unwrapped.type !== "Identifier") return false;
  const variable = findVariable(scope, unwrapped.name);
  return variable && unvalidatedVariables.has(variable);
}

function getScope(context, node) {
  if (context.getScope) {
    return context.getScope();
  }
  return context.sourceCode.getScope(node);
}

function getDeclaredVariables(context, node) {
  if (context.getDeclaredVariables) {
    return context.getDeclaredVariables(node);
  }
  return context.sourceCode.getDeclaredVariables(node);
}

module.exports = { 
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Zod (or similar) schema validation on `response.json()` before property access.",
      category: "Data integrity",
      recommended: true,
    }, 
    schema: [],
    messages: {
      unparsedJsonAccess:
        "Property access on the result of `response.json()` without a schema parse. Pipe through `XSchema.parse(...)` (Zod) before reading fields.",
    },
  },
  create(context) {
    const unvalidatedVariables = new Set();

    return {
      VariableDeclarator(node) {
        const scope = getScope(context, node);
        if (node.id.type === "Identifier") {
          if (isJsonCall(node.init)) {
            const variables = getDeclaredVariables(context, node);
            const variable = variables[0];
            if (variable) {
              unvalidatedVariables.add(variable);
            }
          }
        } else if (
          node.id.type === "ObjectPattern" ||
          node.id.type === "ArrayPattern"
        ) {
          if (isJsonCall(node.init)) {
            context.report({ node: node.id, messageId: "unparsedJsonAccess" });
          } else if (isUnvalidatedVariable(node.init, scope, unvalidatedVariables)) {
            context.report({ node: node.id, messageId: "unparsedJsonAccess" });
          }
        }
      },
      AssignmentExpression(node) {
        const scope = getScope(context, node);
        if (node.left.type === "Identifier") {
          const variable = findVariable(scope, node.left.name);
          if (variable) {
            if (isJsonCall(node.right)) {
              unvalidatedVariables.add(variable);
            } else {
              // Reassigned to a parse call or something else: remove from tracking
              unvalidatedVariables.delete(variable);
            }
          }
        } else if (
          node.left.type === "ObjectPattern" ||
          node.left.type === "ArrayPattern"
        ) {
          if (isJsonCall(node.right)) {
            context.report({ node: node.left, messageId: "unparsedJsonAccess" });
          } else if (isUnvalidatedVariable(node.right, scope, unvalidatedVariables)) {
            context.report({ node: node.left, messageId: "unparsedJsonAccess" });
          }
        }
      },
      MemberExpression(node) {
        const scope = getScope(context, node);
        const obj = unwrap(node.object);
        if (isJsonCall(obj)) {
          context.report({ node, messageId: "unparsedJsonAccess" });
        } else if (isUnvalidatedVariable(obj, scope, unvalidatedVariables)) {
          context.report({ node, messageId: "unparsedJsonAccess" });
          const variable = findVariable(scope, obj.name);
          if (variable) {
            unvalidatedVariables.delete(variable);
          }
        }
      },
    };
  },
};