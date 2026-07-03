import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    testTimeout: 15000,
    include: [
      "apps/**/*.test.{ts,tsx}",
      "packages/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/node_modules.nosync/**",
      "**/*.contract.test.ts",
    ],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      include: [
        "apps/web/lib/**",
        "apps/web/app/**",
        "apps/web/components/**",
        "packages/shared/**",
      ],
      exclude: [
        "**/*.test.*",
        "**/*.d.ts",
        "**/*.md",
        "**/node_modules.nosync/**",
        "**/__fixtures__/**",
        "**/fonts/**",
        // Type-only modules: no runtime behaviour to measure
        "packages/shared/src/types.ts",
        "packages/shared/src/stats-schema.ts",
        // i18n dictionaries: pure data, no branching logic
        "apps/web/lib/i18n/dictionaries/**",
        // Index re-exports: just re-export other modules
        "packages/shared/src/index.ts",
        "apps/web/lib/*/index.ts",
        // Test helpers and stubs
        "test/**",
        "apps/web/test/**",
      ],
      thresholds: {
        statements: 75,
        branches: 70,
        functions: 65,
        lines: 75,
      },
    },
  },
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "apps/web") + "/",
      "@chapa/shared": path.resolve(__dirname, "packages/shared/src"),
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
});
