import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15_000,
    include: ["scripts/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/node_modules.nosync/**"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: "coverage/scripts",
      include: ["scripts/**/*.ts"],
      exclude: ["scripts/**/*.test.ts"],
      thresholds: {
        statements: 55,
        branches: 60,
        functions: 70,
        lines: 55,
      },
    },
  },
  resolve: {
    alias: {
      "@/": `${path.resolve(import.meta.dirname, "apps/web")}/`,
      "@chapa/shared": path.resolve(import.meta.dirname, "packages/shared/src"),
      "server-only": path.resolve(
        import.meta.dirname,
        "test/stubs/server-only.ts",
      ),
    },
  },
});
