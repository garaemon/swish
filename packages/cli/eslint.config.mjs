import { defineConfig, globalIgnores } from "eslint/config";
import { baseConfig } from "../../eslint.config.base.mjs";

const eslintConfig = defineConfig([
  ...baseConfig,
  globalIgnores([
    "dist/**",
  ]),
]);

export default eslintConfig;
