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
  {
    // SQL and the database handle stay in src/db.
    files: ["app/**", "src/components/**", "src/hooks/**"],
    rules: {
      "no-restricted-imports": ["error", { paths: ["expo-sqlite"], patterns: [{ group: ["**/db/database"], importNames: ["getDatabase"] }] }],
    },
  },
  {
    // Use logError, not console.error.
    files: ["app/**", "src/**"],
    ignores: ["src/utils/errors.ts", "src/__tests__/**"],
    rules: { "no-console": ["error", { allow: ["log", "warn"] }] },
  },
]);
