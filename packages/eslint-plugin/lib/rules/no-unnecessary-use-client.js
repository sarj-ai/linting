/**
 * @fileoverview Flag 'use client' files with no hooks or event handlers.
 *
 * If a file is marked `'use client'` but contains no hook calls
 * (`useState`/`useEffect`/etc.) and no JSX event handlers (`onClick`,
 * `onChange`, etc.), the directive is likely unnecessary and the file
 * could be a React Server Component — improving cold-start, bundle size,
 * and SEO.
 *
 * False-positive watch: components that only use client-side context
 * (e.g. theme providers) without hooks or events still need 'use client'.
 * This rule is warn-by-default in the `recommended` config.
 *
 * References:
 *   - https://nextjs.org/docs/app/building-your-application/rendering/client-components
 */

const HOOK_REGEX = /^use([A-Z]|$)/;
const EVENT_PROP_REGEX = /^on[A-Z]/;

const BROWSER_GLOBALS = new Set([
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "location",
  "history",
  "screen",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "CustomEvent",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "TouchEvent",
]);

const CLIENT_ONLY_PACKAGES_REGEX = /^(?:@radix-ui\/|framer-motion|react-dom|react-day-picker|@floating-ui\/|react-select|react-toastify|react-hook-form|recharts|react-dropzone|react-slick|react-swipeable|react-resizable|react-draggable|react-beautiful-dnd|@hello-pangea\/dnd|react-virtualized|react-window|@tanstack\/react-table|@tanstack\/react-query|react-redux|recoil|jotai|zustand|@tippyjs\/react|react-color|react-datepicker|next-themes|react-helmet|react-helmet-async|styled-components|@emotion\/)/;

function isUseClientDirective(node) {
  return (
    node &&
    node.type === "ExpressionStatement" &&
    node.expression &&
    node.expression.type === "Literal" &&
    node.expression.value === "use client"
  );
}

function getScope(context, node) {
  if (context.sourceCode && typeof context.sourceCode.getScope === "function") {
    return context.sourceCode.getScope(node);
  }
  if (typeof context.getScope === "function") {
    return context.getScope();
  }
  return null;
}

function getFilename(context) {
  if (context.filename) return context.filename;
  if (typeof context.getFilename === "function") {
    return context.getFilename();
  }
  if (context.sourceCode && typeof context.sourceCode.getFilename === "function") {
    return context.sourceCode.getFilename();
  }
  return "";
}

function isGlobalReference(node, context) {
  if (!BROWSER_GLOBALS.has(node.name)) return false;

  const parent = node.parent;
  if (parent) {
    if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) {
      return false;
    }
    if (parent.type === "Property" && parent.key === node && !parent.computed) {
      return false;
    }
    if (parent.type.startsWith("TS")) {
      return false;
    }
  }

  let scope = getScope(context, node);
  while (scope) {
    const variable = scope.set.get(node.name);
    if (variable) {
      if (variable.defs && variable.defs.length > 0) {
        return false;
      }
    }
    scope = scope.upper;
  }

  return true;
}

module.exports = { 
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flag 'use client' files with no hooks or event handlers — they could be RSC.",
      category: "Next.js",
      recommended: false,
    },
    schema: [],
    messages: {
      unnecessaryUseClient:
        "'use client' directive but no hooks (use*), JSX event handlers (on*), browser globals, or client-only imports found. Consider removing the directive and serving as a React Server Component.",
    },
  }, 
  create(context) {
    const filename = getFilename(context);
    if (/\b(?:global-)?error\.[jt]sx?$/.test(filename)) {
      return {};
    }

    let directiveNode = null;
    let hasClientIndicator = false;

    return {
      Program(node) {
        for (const stmt of node.body) {
          if (isUseClientDirective(stmt)) {
            directiveNode = stmt;
            break;
          } 
          if (stmt.type !== "ExpressionStatement") break;
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          HOOK_REGEX.test(node.callee.name)
        ) {
          hasClientIndicator = true;
        } else if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          HOOK_REGEX.test(node.callee.property.name)
        ) {
          hasClientIndicator = true;
        } else if (
          node.callee.type === "Identifier" &&
          node.callee.name === "createContext"
        ) {
          hasClientIndicator = true;
        } else if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "createContext"
        ) {
          hasClientIndicator = true;
        }
      },
      JSXAttribute(node) {
        if (
          node.name &&
          node.name.type === "JSXIdentifier" &&
          EVENT_PROP_REGEX.test(node.name.name)
        ) {
          hasClientIndicator = true;
        }
      },
      ImportDeclaration(node) {
        if (node.source && CLIENT_ONLY_PACKAGES_REGEX.test(node.source.value)) {
          hasClientIndicator = true;
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          hasClientIndicator = true;
        }
      },
      ExportAllDeclaration(node) {
        if (node.source) {
          hasClientIndicator = true;
        }
      },
      ClassDeclaration() {
        hasClientIndicator = true;
      },
      ClassExpression() {
        hasClientIndicator = true;
      },
      Identifier(node) {
        if (isGlobalReference(node, context)) {
          hasClientIndicator = true;
        }
      },
      "Program:exit"() {
        if (directiveNode && !hasClientIndicator) {
          context.report({
            node: directiveNode,
            messageId: "unnecessaryUseClient",
          });
        }
      },
    };
  },
};