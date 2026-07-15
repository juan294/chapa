import { createRequire } from "module";

const require = createRequire(import.meta.url);

const nextConfig = require("eslint-config-next");
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");
const nextTypescript = require("eslint-config-next/typescript");

const eslintConfig = [
  { ignores: [".next/", "node_modules/", "next-env.d.ts", ".worktrees/"] },
  ...nextConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Enforce typed env-getter usage in application source (lib/ and app/).
    // Excludes: env.ts itself, test files, client components (where Next.js
    // requires direct NEXT_PUBLIC_* access for build-time inlining), config
    // files, and scripts.
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["lib/env.ts", "**/*.test.*", "**/*.spec.*"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']",
          message:
            "Access env vars through @/lib/env getters instead of process.env directly.",
        },
        {
          // Catches bare/whole-object reads (e.g. `{ ...process.env }` or
          // `const e = process.env`) that the 3-level selector above misses,
          // since those are 2-level MemberExpressions with no trailing
          // `.SOME_VAR` property access. Excludes the case where this node is
          // itself the `.object` of a further property access (`process.env.X`),
          // since that 3-level chain is already reported by the selector above.
          selector:
            "MemberExpression[object.name='process'][property.name='env']:not(* > MemberExpression.object)",
          message:
            "Access env vars through @/lib/env getters instead of process.env directly.",
        },
      ],
    },
  },
  {
    // Enforce @chapa/shared workspace alias — no relative imports to packages/shared.
    // Application code must use `@chapa/shared`, never `../../packages/shared/src/...`.
    // This matches the CLAUDE.md CI gate: "packages/shared import boundary".
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["**/packages/shared/**"],
        },
      ],
    },
  },
];

export default eslintConfig;
