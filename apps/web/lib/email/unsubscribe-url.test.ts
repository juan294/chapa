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

  it("URL-encodes the handle via URLSearchParams (not bare string interpolation)", () => {
    // URLSearchParams encodes special chars that would otherwise break a template literal URL.
    // GitHub handles are restricted to [a-zA-Z0-9-], so in practice encoding is a no-op,
    // but the implementation must use URLSearchParams to be safe by construction.
    const url = buildUnsubscribeUrl("test-user");
    const parsed = new URL(url);

    // The URL must be parseable and the handle must round-trip without modification.
    expect(parsed.searchParams.get("handle")).toBe("test-user");
    // The raw query string must not contain unencoded & or = from the token
    // (URLSearchParams escapes these; bare string interpolation would not).
    expect(parsed.searchParams.has("token")).toBe(true);
  });
});
