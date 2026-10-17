import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "plugin/dist/",
      "coverage/",
      "azimuth-viewer-handoff/",
      "test/fixtures/",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
      "no-var": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["viewer/src/**/*.{ts,tsx}"],
    ...reactHooks.configs.flat.recommended,
  },
);
