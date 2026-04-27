import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3001";
const useExternalBaseUrl = Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim());

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "html",

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
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
