import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/analytics/server-errors", () => ({
  withErrorCapture: (_route: string, handler: unknown) => handler,
}));

function request(): NextRequest {
  return new NextRequest("http://localhost:3001/api/version");
}

describe("GET /api/version", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns only the trimmed deployment identity fields", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", `  ${"a".repeat(40)}  `);
    vi.stubEnv("VERCEL_ENV", " preview ");
    vi.stubEnv("GITHUB_TOKEN", "must-not-leak");

    const response = await GET(request());

    expect(await response.json()).toEqual({
      commitSha: "a".repeat(40),
      environment: "preview",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("reports deliberate nulls outside a Vercel deployment", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.stubEnv("VERCEL_ENV", "");

    const response = await GET(request());

    expect(await response.json()).toEqual({
      commitSha: null,
      environment: null,
    });
  });
});
