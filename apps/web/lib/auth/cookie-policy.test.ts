import { describe, it, expect } from "vitest";
import { buildAuthCookieFlags } from "./cookie-policy";

describe("buildAuthCookieFlags", () => {
  it("includes Secure when origin is undefined", () => {
    expect(buildAuthCookieFlags()).toContain("Secure");
  });

  it("includes Secure for non-localhost http origins", () => {
    expect(buildAuthCookieFlags("http://chapa.thecreativetoken.com")).toContain(
      "Secure",
    );
  });

  it("omits Secure only for explicit localhost http origins", () => {
    expect(buildAuthCookieFlags("http://localhost:3001")).not.toContain(
      "Secure",
    );
    expect(buildAuthCookieFlags("http://127.0.0.1:3001")).not.toContain(
      "Secure",
    );
  });
});
