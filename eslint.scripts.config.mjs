import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["node_modules/", "node_modules.nosync/", ".worktrees/"],
  },
  {
    files: ["scripts/**/*.ts"],
    ignores: ["scripts/**/*.test.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.scripts.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-constant-condition": "error",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-fallthrough": "error",
      "no-irregular-whitespace": "error",
      "no-unreachable-loop": "error",
      "no-useless-assignment": "error",
      "no-useless-catch": "error",
      "no-useless-escape": "error",
      "prefer-const": "error",
    },
  },
];
