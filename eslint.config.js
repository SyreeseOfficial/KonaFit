const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expo,
  {
    ignores: ["dist/*", ".expo/*"],
    // ponytail: React-compiler-style rules flag established patterns here (load-on-open effects); warn, fix as touched.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);
