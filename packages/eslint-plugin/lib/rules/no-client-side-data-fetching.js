/**
 * @fileoverview Disallow data fetching inside useEffect — move to RSC / Server Action or client-side cache.
 *
 * Anti-pattern:
 *
 *   useEffect(() => { fetch('/data').then(setData); }, []);
 *
 * Causes a client-side waterfall (render → effect → fetch → re-render), forfeits
 * caching, and produces layout shift. In Next.js App Router, prefer:
 *   - a React Server Component that fetches at render time, or
 *   - a Server Action invoked from a form / onClick handler.
 *   - client-side caching libraries like SWR or React Query.
 *
 * References:
 *   - https://nextjs.org/docs/app/building-your-application/data-fetching
 *   - https://react.dev/reference/react/useEffect#fetching-data-with-effects
 */

const FETCH_LIBS = new Set(["axios", "ky", "superagent"]);

function isUseEffect(node) {
  if (node.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee.type === "Identifier" && callee.name === "useEffect") {
    return true;
  }
  if (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "React" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "useEffect"
  ) {
    return true;
  }
  return false;
}

function isFetchCall(node) {
  if (node.type !== "CallExpression") return false;
  const callee = node.callee;

  // fetch(...)
  if (callee.type === "Identifier" && callee.name === "fetch") {
    const optionsArg = node.arguments[1];
    if (optionsArg && optionsArg.type === "ObjectExpression") {
      const methodProp = optionsArg.properties.find(
        (prop) =>
          prop.type === "Property" &&
          prop.key.type === "Identifier" &&
          prop.key.name === "method"
      );
      if (methodProp && methodProp.value.type === "Literal") {
        const method = String(methodProp.value.value).toUpperCase();
        if (method !== "GET") {
          return false; // Ignore non-GET requests (e.g. POST analytics)
        }
      }
    }
    return true;
  }

  // axios.get(...), ky.get(...), superagent.get(...)
  if (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    FETCH_LIBS.has(callee.object.name) &&
    callee.property.type === "Identifier"
  ) {
    if (callee.property.name === "get") {
      return true;
    }
    if (["post", "put", "delete", "patch"].includes(callee.property.name)) {
      return false;
    }
  }

  // axios(...) or ky(...)
  if (
    callee.type === "Identifier" &&
    (callee.name === "axios" || callee.name === "ky")
  ) {
    const configArg = node.arguments[0]?.type === "ObjectExpression"
      ? node.arguments[0]
      : node.arguments[1]?.type === "ObjectExpression"
        ? node.arguments[1]
        : null;

    if (configArg) {
      const methodProp = configArg.properties.find(
        (prop) =>
          prop.type === "Property" &&
          prop.key.type === "Identifier" &&
          prop.key.name === "method"
      );
      if (methodProp && methodProp.value.type === "Literal") {
        const method = String(methodProp.value.value).toUpperCase();
        if (method !== "GET") {
          return false;
        }
      }
    }
    return true;
  }

  return false;
}

function isAnalyticsCall(node) {
  const firstArg = node.arguments[0];
  if (!firstArg) return false;

  let urlString = "";
  if (firstArg.type === "Literal" && typeof firstArg.value === "string") {
    urlString = firstArg.value;
  } else if (firstArg.type === "TemplateLiteral") {
    urlString = firstArg.quasis.map((q) => q.value.cooked).join("");
  } else if (firstArg.type === "Identifier") {
    urlString = firstArg.name;
  }

  const lowercaseUrl = urlString.toLowerCase();
  const analyticsKeywords = [
    "analytics",
    "telemetry",
    "track",
    "log",
    "ping",
    "beacon",
    "metrics",
    "event",
  ];
  return analyticsKeywords.some((keyword) => lowercaseUrl.includes(keyword));
}

module.exports = { 
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct data fetching inside useEffect; suggest Server Components, Server Actions, or client-side caching libraries.",
      category: "Next.js",
      recommended: true,
    },
    schema: [],
    messages: {
      noClientFetch:
        "Avoid direct data fetching inside useEffect. This causes waterfalls and layout shifts. Prefer React Server Components, Server Actions, or client-side caching libraries like SWR or React Query.",
    },
  },
  create(context) {
    let inUseEffect = 0;
    return {
      CallExpression(node) {
        if (isUseEffect(node)) {
          inUseEffect++;
        } else if (inUseEffect > 0) {
          if (isFetchCall(node) && !isAnalyticsCall(node)) {
            context.report({ node, messageId: "noClientFetch" });
          }
        }
      },
      "CallExpression:exit"(node) {
        if (isUseEffect(node)) {
          inUseEffect--;
        }
      },
    };
  },
};