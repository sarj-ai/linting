/**
 * @fileoverview Prefer Next.js Server Actions over /api/* mutations.
 *
 * Anti-pattern:
 *
 *   await fetch('/api/orders', {
 *     method: 'POST',
 *     body: JSON.stringify({ id }),
 *   });
 *
 * Server Actions are the canonical Next.js (App Router) mechanism for mutations
 * from the client: they're typed end-to-end, skip the JSON round-trip, and
 * compose with `revalidatePath`/`revalidateTag`. Hand-rolled `/api/*` route
 * handlers should be reserved for webhooks and external integrations.
 *
 * References:
 *   - https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
 */

const MUTATION_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);
const AXIOS_MUTATION_METHODS = new Set(["post", "put", "delete", "patch"]);

function getScope(context, node) {
  if (context.sourceCode && typeof context.sourceCode.getScope === "function") {
    return context.sourceCode.getScope(node);
  }
  if (typeof context.getScope === "function") {
    return context.getScope();
  }
  return null;
}

function resolveNode(node, context) {
  if (!node) return null;
  if (node.type === "Identifier") {
    let scope = getScope(context, node);
    while (scope) {
      const variable = scope.set.get(node.name);
      if (variable && variable.defs && variable.defs.length === 1) {
        const def = variable.defs[0];
        if (def.type === "Variable" && def.node && def.node.init) {
          return def.node.init;
        }
      }
      scope = scope.upper;
    }
  }
  return node;
}

function isApiUrl(node, context) {
  const resolved = resolveNode(node, context);
  if (!resolved) return false;
  
  if (resolved.type === "Literal" && typeof resolved.value === "string") {
    return resolved.value.startsWith("/api/");
  }
  if (resolved.type === "TemplateLiteral") {
    const firstQuasi = resolved.quasis[0];
    return !!(firstQuasi && firstQuasi.value.cooked && firstQuasi.value.cooked.startsWith("/api/"));
  }
  if (resolved.type === "BinaryExpression" && resolved.operator === "+") {
    return isApiUrl(resolved.left, context);
  }
  return false;
}

function isMutationMethod(node, context) {
  const resolved = resolveNode(node, context);
  if (!resolved) return false;
  
  if (resolved.type === "Literal" && typeof resolved.value === "string") {
    return MUTATION_METHODS.has(resolved.value.toUpperCase());
  }
  
  if (resolved.type === "TemplateLiteral" && resolved.expressions.length === 0) {
    const val = resolved.quasis.map((q) => q.value.cooked).join("");
    return MUTATION_METHODS.has(val.toUpperCase());
  }
  
  if (resolved.type === "ConditionalExpression") {
    return isMutationMethod(resolved.consequent, context) || isMutationMethod(resolved.alternate, context);
  }
  
  if (resolved.type === "LogicalExpression" && resolved.operator === "||") {
    return isMutationMethod(resolved.left, context) || isMutationMethod(resolved.right, context);
  }
  
  return false;
}

function getPropertyNode(objNode, propName) {
  if (!objNode || objNode.type !== "ObjectExpression") return null;
  for (const prop of objNode.properties) {
    if (prop.type === "Property") {
      const keyName = prop.key.type === "Identifier" ? prop.key.name : (prop.key.type === "Literal" ? prop.key.value : null);
      if (keyName === propName) {
        return prop.value;
      }
    }
  }
  return null;
}

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer Next.js Server Actions over /api/* mutations.",
      category: "Next.js",
      recommended: true,
    },
    schema: [],
    messages: {
      preferServerAction:
        "Mutation against /api/* — prefer a Next.js Server Action for type-safety and to avoid the JSON round-trip.",
    },
  },
  create(context) {
    return { 
      CallExpression(node) {
        let isMutation = false;

        // 1. Standard fetch('/api/orders', { method: 'POST' })
        if (node.callee.type === "Identifier" && node.callee.name === "fetch") {
          const urlArg = node.arguments[0];
          if (isApiUrl(urlArg, context)) {
            const initArg = node.arguments[1];
            const resolvedInit = resolveNode(initArg, context);
            const methodNode = getPropertyNode(resolvedInit, "method");
            if (methodNode && isMutationMethod(methodNode, context)) {
              isMutation = true;
            }
          }
        }
        // 2. Custom wrappers or Axios: api.post('/api/orders') or axios.put('/api/orders')
        else if (node.callee.type === "MemberExpression" && node.callee.property.type === "Identifier") {
          const methodName = node.callee.property.name.toLowerCase();
          if (AXIOS_MUTATION_METHODS.has(methodName)) {
            const urlArg = node.arguments[0];
            if (isApiUrl(urlArg, context)) {
              isMutation = true;
            }
          }
        }
        // 3. Direct axios/request call: axios({ method: 'post', url: '/api/orders' })
        else if (node.callee.type === "Identifier" && (node.callee.name === "axios" || node.callee.name === "request")) {
          const configArg = resolveNode(node.arguments[0], context);
          if (configArg && configArg.type === "ObjectExpression") {
            const urlNode = getPropertyNode(configArg, "url");
            const methodNode = getPropertyNode(configArg, "method");
            if (urlNode && isApiUrl(urlNode, context)) {
              if (methodNode && isMutationMethod(methodNode, context)) {
                isMutation = true;
              }
            }
          }
        }

        if (isMutation) {
          context.report({ node, messageId: "preferServerAction" });
        }
      },
    };
  },
};
