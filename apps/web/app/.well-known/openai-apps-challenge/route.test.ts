import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /.well-known/openai-apps-challenge", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 when the challenge token is not configured", async () => {
    vi.stubEnv("OPENAI_APPS_CHALLENGE_TOKEN", undefined);

    const response = GET();

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Not configured");
  });

  it("returns only the exact trimmed token without caching", async () => {
    vi.stubEnv("OPENAI_APPS_CHALLENGE_TOKEN", "  challenge-token-1260\n");

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("challenge-token-1260");
  });
});
