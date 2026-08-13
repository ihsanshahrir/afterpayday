import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist", "dev-dist", "node_modules", "public/tesseract"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
        __APP_VERSION__: "readonly",
      },
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Unused vars are errors, but allow intentionally-ignored args/catch
      // bindings prefixed with _ (the codebase uses `catch (_)`).
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none", varsIgnorePattern: "^[A-Z_]" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // Test files run under Vitest globals.
    files: ["**/*.test.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
