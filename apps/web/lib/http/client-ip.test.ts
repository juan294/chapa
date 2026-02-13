import { describe, it, expect } from "vitest";
import { getClientIp } from "./client-ip";

function makeRequest(headers: Record<string, string> = {}): Request {
  const h = new Headers();
  for (const [k, v] of Object.entries(headers)) {
    h.set(k, v);
  }
  return new Request("https://example.com", { headers: h });
}

describe("getClientIp", () => {
  it("returns x-real-ip when present", () => {
    const req = makeRequest({ "x-real-ip": "1.2.3.4" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns first entry from x-forwarded-for when x-real-ip is absent", () => {
    const req = makeRequest({ "x-forwarded-for": "10.0.0.1, 10.0.0.2, 10.0.0.3" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("trims whitespace from x-forwarded-for entries", () => {
    const req = makeRequest({ "x-forwarded-for": "  192.168.1.1  , 10.0.0.2" });
    expect(getClientIp(req)).toBe("192.168.1.1");
  });

  it('returns "unknown" when no IP headers present', () => {
    const req = makeRequest();
    expect(getClientIp(req)).toBe("unknown");
  });

  it("prefers x-real-ip over x-forwarded-for when both present", () => {
    const req = makeRequest({
      "x-real-ip": "5.6.7.8",
      "x-forwarded-for": "9.10.11.12",
    });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("handles empty x-forwarded-for gracefully", () => {
    const req = makeRequest({ "x-forwarded-for": "" });
    expect(getClientIp(req)).toBe("unknown");
  });

  it("trims whitespace from x-real-ip", () => {
    const req = makeRequest({ "x-real-ip": "  3.4.5.6  " });
    expect(getClientIp(req)).toBe("3.4.5.6");
  });
});
