import js from "@eslint/js";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      ".npm-cache/**",
      "ui-audit/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}", "public/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.vitest,
      },
    },
    plugins: {
      "jsx-a11y": jsxA11y,
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...jsxA11y.configs.recommended.rules,
      // Natural apostrophes in JSX text are safe and more readable than HTML
      // entities; this rule does not catch a runtime or accessibility defect.
      "react/no-unescaped-entities": "off",
      "react/prop-types": "off",
      // Search screens and newly revealed form fields intentionally receive
      // focus. Their surrounding flows retain normal keyboard navigation.
      "jsx-a11y/no-autofocus": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["vite.config.js", "eslint.config.js", "src/scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Vercel Edge Middleware + its shared pure helper. The edge runtime is a
    // web-worker-like environment (fetch/URL/Response/AbortController/timers)
    // plus process.env for configuration.
    files: ["middleware.js", "ogInject.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        process: "readonly",
      },
    },
  },
];
