module.exports = {
  rules: {
    // Foundations (pre-1.1.0)
    "zod-naming-convention": require("./rules/zod-naming-convention"),
    "require-assert-never": require("./rules/require-assert-never"),
    "require-zod-form-validation": require("./rules/require-zod-form-validation"),
    "enforce-file-structure": require("./rules/enforce-file-structure"),
    "no-raw-env": require("./rules/no-raw-env"),
    "prefer-shadcn": require("./rules/prefer-shadcn"),
    "no-enum": require("./rules/no-enum"),

    // Next.js / RSC boundary (added 1.1.0)
    "no-client-side-data-fetching": require("./rules/no-client-side-data-fetching"),
    "prefer-server-actions": require("./rules/prefer-server-actions"),
    "no-unnecessary-use-client": require("./rules/no-unnecessary-use-client"),
    "prefer-schema-for-api-payload": require("./rules/prefer-schema-for-api-payload"),
  },
  configs: {
    // Basic sarj rules only
    recommended: {
      plugins: ["@sarj"],
      rules: {
        "@sarj/zod-naming-convention": "warn",
        "@sarj/require-assert-never": "error",
        "@sarj/require-zod-form-validation": "error",
        "@sarj/enforce-file-structure": "warn",
        "@sarj/no-client-side-data-fetching": "warn",
        "@sarj/prefer-server-actions": "warn",
        "@sarj/no-unnecessary-use-client": "warn",
        "@sarj/prefer-schema-for-api-payload": "warn",
      },
    },
    // All sarj rules at error level
    strict: {
      plugins: ["@sarj"],
      rules: {
        "@sarj/zod-naming-convention": "error",
        "@sarj/require-assert-never": "error",
        "@sarj/require-zod-form-validation": "error",
        "@sarj/enforce-file-structure": "error",
        "@sarj/no-raw-env": "error",
        "@sarj/prefer-shadcn": "error",
        "@sarj/no-enum": "error",
        "@sarj/no-client-side-data-fetching": "error",
        "@sarj/prefer-server-actions": "error",
        "@sarj/no-unnecessary-use-client": "error",
        "@sarj/prefer-schema-for-api-payload": "error",
      },
    },
    // Comprehensive style guide rules (sarj + external)
    "style-guide": {
      plugins: ["@sarj"],
      rules: {
        // === Sarj custom rules ===
        "@sarj/zod-naming-convention": "error",
        "@sarj/require-assert-never": "error",
        "@sarj/require-zod-form-validation": "error",
        "@sarj/enforce-file-structure": "error",
        "@sarj/no-raw-env": "error",
        "@sarj/prefer-shadcn": "error",
        "@sarj/no-enum": "error",
        "@sarj/no-client-side-data-fetching": "error",
        "@sarj/prefer-server-actions": "warn",
        "@sarj/no-unnecessary-use-client": "warn",
        "@sarj/prefer-schema-for-api-payload": "error",

        // === Core ESLint rules ===
        "no-var": "error",
        "prefer-const": "error",
        "object-shorthand": ["error", "always"],
        "no-nested-ternary": "error",
        "no-console": ["warn", { allow: ["warn", "error"] }],
        eqeqeq: ["error", "always"],
        "no-param-reassign": "error",
        "no-return-await": "error",
        "prefer-template": "error",
        "array-callback-return": "error",

        // === Complexity limits ===
        complexity: ["warn", { max: 15 }],
        "max-depth": ["warn", { max: 4 }],
        "max-nested-callbacks": ["warn", { max: 3 }],
        "max-params": ["error", { max: 5 }],
      },
    },
  },
};
