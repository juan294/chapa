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
            "MemberExpression[object.object.name='process'][object.property.name='env'][computed=false]",
          message:
            "Access env vars through @/lib/env getters instead of process.env directly.",
        },
      ],
    },
  },
];

export default eslintConfig;
