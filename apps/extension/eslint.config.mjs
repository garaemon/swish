import { defineConfig, globalIgnores } from "eslint/config";
import { baseConfig } from "../../eslint.config.base.mjs";

const eslintConfig = defineConfig([
  ...baseConfig,
  globalIgnores([
    ".output/**",
    ".wxt/**",
  ]),
]);

export default eslintConfig;
