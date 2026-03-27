const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  {
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
  },
  ...(Array.isArray(expoConfig) ? expoConfig : [expoConfig]),
  {
    ignores: ["dist/*"],
  },
]);