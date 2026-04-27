import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildUnsubscribeUrl } from "./unsubscribe-url";
import { verifyUnsubscribeToken } from "@/lib/auth/unsubscribe-token";

const SECRET = "test-unsubscribe-secret";

describe("buildUnsubscribeUrl", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;
  const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.test";
  });

  afterEach(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
    process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
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
    delete process.env.NEXT_PUBLIC_BASE_URL;

    const url = buildUnsubscribeUrl("juan294");

    expect(url.startsWith("https://chapa.thecreativetoken.com/")).toBe(true);
  });
});
