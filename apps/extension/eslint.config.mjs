import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import { baseConfig } from "../../eslint.config.base.mjs";

// baseConfig is framework-free, so the React hook rules are added here. apps/web
// gets the same rules through eslint-config-next; keeping the two React trees on
// one rule set matters more than the individual rules.
const eslintConfig = defineConfig([
  ...baseConfig,
  reactHooks.configs.flat.recommended,
  globalIgnores([
    ".output/**",
    ".wxt/**",
  ]),
]);

export default eslintConfig;
