import { describe, it, expect } from "vitest";
import { getClientIp, NO_TRUSTED_IP } from "./client-ip";

function makeRequest(headers: Record<string, string> = {}): Request {
  const h = new Headers();
  for (const [k, v] of Object.entries(headers)) {
    h.set(k, v);
  }
  return new Request("https://example.com", { headers: h });
}

describe("getClientIp", () => {
  it("returns x-vercel-forwarded-for when present (trusted Vercel header)", () => {
    const req = makeRequest({ "x-vercel-forwarded-for": "1.2.3.4" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("trims whitespace from x-vercel-forwarded-for", () => {
    const req = makeRequest({ "x-vercel-forwarded-for": "  1.2.3.4  " });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns rightmost hop from x-forwarded-for when x-vercel-forwarded-for is absent", () => {
    const req = makeRequest({ "x-forwarded-for": "10.0.0.1, 10.0.0.2, 1.2.3.4" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns single entry from x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "10.0.0.1" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("trims whitespace from x-forwarded-for rightmost hop", () => {
    const req = makeRequest({ "x-forwarded-for": "10.0.0.1, 10.0.0.2,  192.168.1.1  " });
    expect(getClientIp(req)).toBe("192.168.1.1");
  });

  it('returns "unknown" when no IP headers present', () => {
    const req = makeRequest();
    expect(getClientIp(req)).toBe("unknown");
  });

  it("prefers x-vercel-forwarded-for over x-forwarded-for when both present", () => {
    const req = makeRequest({
      "x-vercel-forwarded-for": "5.6.7.8",
      "x-forwarded-for": "9.10.11.12, 3.3.3.3",
    });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("handles empty x-forwarded-for gracefully", () => {
    const req = makeRequest({ "x-forwarded-for": "" });
    expect(getClientIp(req)).toBe("unknown");
  });

  it("ignores x-real-ip (client-controlled, not trusted)", () => {
    const req = makeRequest({
      "x-real-ip": "9.9.9.9",
      "x-vercel-forwarded-for": "5.6.7.8",
    });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("falls back to unknown when x-real-ip is present but x-vercel-forwarded-for is not", () => {
    const req = makeRequest({ "x-real-ip": "9.9.9.9" });
    // x-real-ip alone is not trusted — "unknown" is returned
    expect(getClientIp(req)).toBe("unknown");
  });

  it("returns 'unknown' when x-forwarded-for last hop is whitespace-only", () => {
    // "10.0.0.1, " splits into ["10.0.0.1", " "] — last.trim() is "" → falls through
    const req = makeRequest({ "x-forwarded-for": "10.0.0.1, " });
    expect(getClientIp(req)).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// BE-M1 (#868): NO_TRUSTED_IP sentinel for safe-fail rate-limiting
// ---------------------------------------------------------------------------

describe("NO_TRUSTED_IP constant (BE-M1)", () => {
  it("is exported as a string constant equal to 'unknown'", () => {
    // The sentinel value is "unknown" — callers must check for it and apply
    // a strict global cap rather than a shared-bucket rate-limit key.
    expect(NO_TRUSTED_IP).toBe("unknown");
  });

  it("getClientIp returns NO_TRUSTED_IP (not a real IP) when no trusted header is present", () => {
    const req = makeRequest();
    expect(getClientIp(req)).toBe(NO_TRUSTED_IP);
  });

  it("getClientIp does NOT return NO_TRUSTED_IP when a trusted header is present", () => {
    const req = makeRequest({ "x-vercel-forwarded-for": "1.2.3.4" });
    expect(getClientIp(req)).not.toBe(NO_TRUSTED_IP);
    expect(getClientIp(req)).toBe("1.2.3.4");
  });
});
