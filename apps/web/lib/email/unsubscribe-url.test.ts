import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildUnsubscribeUrl } from "./unsubscribe-url";
import { verifyUnsubscribeToken } from "@/lib/auth/unsubscribe-token";

const SECRET = "test-unsubscribe-secret";

describe("buildUnsubscribeUrl", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds an unsubscribe URL with lowercased handle and a verifiable token", () => {
    const url = new URL(buildUnsubscribeUrl("MixedCase"));

    expect(url.origin).toBe("https://example.test");
    expect(url.pathname).toBe("/api/notifications/unsubscribe");
    expect(url.searchParams.get("handle")).toBe("mixedcase");

    const token = url.searchParams.get("token");
    expect(token).toBeTruthy();
    expect(verifyUnsubscribeToken("mixedcase", token!, SECRET)).toBe(true);
  });

  it("falls back to the production base URL when NEXT_PUBLIC_BASE_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);

    const url = buildUnsubscribeUrl("juan294");

    expect(url.startsWith("https://chapa.thecreativetoken.com/")).toBe(true);
  });
});
