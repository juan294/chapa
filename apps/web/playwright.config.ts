import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3001";
const useExternalBaseUrl = Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim());
const jsonOutput = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME?.trim();

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/*.test.ts",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: jsonOutput
    ? [
        [process.env.CI ? "github" : "line"],
        ["json", { outputFile: jsonOutput }],
      ]
    : process.env.CI
      ? "github"
      : "html",

  use: {
    baseURL,
    trace: "on-first-retry",
    locale: "es-ES",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],

  ...(useExternalBaseUrl
    ? {}
    : {
        webServer: {
          command: process.env.CI ? "npx next start --port 3001" : "pnpm run dev",
          port: 3001,
          reuseExistingServer: !process.env.CI,
          cwd: __dirname,
        },
      }),
});
