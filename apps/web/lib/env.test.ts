import { describe, it, expect, vi, afterEach } from "vitest";
import { getBaseUrl } from "./env";

describe("getBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns env var when NEXT_PUBLIC_BASE_URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://custom.example.com");
    expect(getBaseUrl()).toBe("https://custom.example.com");
  });

  it("returns fallback when NEXT_PUBLIC_BASE_URL is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    expect(getBaseUrl()).toBe("https://chapa.thecreativetoken.com");
  });

  it("returns fallback when NEXT_PUBLIC_BASE_URL is undefined", () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    expect(getBaseUrl()).toBe("https://chapa.thecreativetoken.com");
  });

  it("trims whitespace from env var", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "  https://custom.example.com  \n");
    expect(getBaseUrl()).toBe("https://custom.example.com");
  });
});
