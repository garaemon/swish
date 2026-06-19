import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Shared ESLint flat config for the Node/TypeScript workspace packages
// (packages/cli, packages/shared). apps/web keeps its own Next.js-specific
// config but mirrors the same style rules below.
export const baseConfig = defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      semi: ["error", "always"],
      curly: ["error", "all"],
      "brace-style": ["error", "1tbs", { allowSingleLine: false }],
      indent: ["error", 2, { SwitchCase: 1 }],
    },
  },
]);
