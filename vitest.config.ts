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
      reporter: ["text-summary"],
      include: [
        "apps/web/lib/**",
        "apps/web/app/**",
        "apps/web/components/**",
        "packages/shared/**",
      ],
      exclude: ["**/*.test.*", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "apps/web/"),
      "@chapa/shared": path.resolve(__dirname, "packages/shared/src"),
    },
  },
});
