import enforceFileStructure from "./rules/enforce-file-structure.js";
import noClientSideDataFetching from "./rules/no-client-side-data-fetching.js";
import noEnum from "./rules/no-enum.js";
import noRawEnv from "./rules/no-raw-env.js";
import noUnnecessaryUseClient from "./rules/no-unnecessary-use-client.js";
import preferSchemaForApiPayload from "./rules/prefer-schema-for-api-payload.js";
import preferServerActions from "./rules/prefer-server-actions.js";
import preferShadcn from "./rules/prefer-shadcn.js";
import requireAssertNever from "./rules/require-assert-never.js";
import requireZodFormValidation from "./rules/require-zod-form-validation.js";
import zodNamingConvention from "./rules/zod-naming-convention.js";

const rules = {
  "enforce-file-structure": enforceFileStructure,
  "no-client-side-data-fetching": noClientSideDataFetching,
  "no-enum": noEnum,
  "no-raw-env": noRawEnv,
  "no-unnecessary-use-client": noUnnecessaryUseClient,
  "prefer-schema-for-api-payload": preferSchemaForApiPayload,
  "prefer-server-actions": preferServerActions,
  "prefer-shadcn": preferShadcn,
  "require-assert-never": requireAssertNever,
  "require-zod-form-validation": requireZodFormValidation,
  "zod-naming-convention": zodNamingConvention,
};

const plugin = {
  meta: {
    name: "@sarj/eslint-plugin",
    version: "2.0.0",
  },
  rules,
  configs: {
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
  },
};

export default plugin;
export { rules };
