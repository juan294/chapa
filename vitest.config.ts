import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: [
      "apps/**/*.test.{ts,tsx}",
      "packages/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
    ],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["apps/web/lib/**", "packages/shared/**"],
    },
  },
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "apps/web/"),
      "@chapa/shared": path.resolve(__dirname, "packages/shared/src"),
    },
  },
});
