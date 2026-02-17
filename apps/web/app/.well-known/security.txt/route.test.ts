import { describe, it, expect } from "vitest";
import { GET as getSecurityTxt } from "./route";

describe("GET /.well-known/security.txt", () => {
  it("returns text/plain response", () => {
    const res = getSecurityTxt();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  it("contains required RFC 9116 fields", async () => {
    const res = getSecurityTxt();
    const text = await res.text();

    // Contact is mandatory per RFC 9116
    expect(text).toMatch(/^Contact:/m);
    // Expires is mandatory per RFC 9116
    expect(text).toMatch(/^Expires:/m);
  });

  it("contains recommended fields", async () => {
    const res = getSecurityTxt();
    const text = await res.text();

    expect(text).toMatch(/^Preferred-Languages:/m);
    expect(text).toMatch(/^Canonical:/m);
  });
});
