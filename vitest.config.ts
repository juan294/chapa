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
    exclude: ["**/node_modules/**", "**/node_modules.nosync/**"],
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
    },
  },
});
