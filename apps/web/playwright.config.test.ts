import { describe, expect, it } from "vitest";
import config from "./playwright.config";

describe("Playwright test discovery", () => {
  it("excludes Vitest regression files colocated with E2E specs", () => {
    expect(config.testIgnore).toBe("**/*.test.ts");
  });
});
