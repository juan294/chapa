import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    testTimeout: 30000,
    include: ["apps/web/**/*.contract.test.ts"],
    exclude: ["**/node_modules/**", "**/node_modules.nosync/**"],
    setupFiles: ["./vitest.contract-setup.ts"],
    coverage: { enabled: false },
  },
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "apps/web") + "/",
      "@chapa/shared": path.resolve(__dirname, "packages/shared/src"),
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
});
