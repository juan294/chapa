import { describe, expect, it } from "vitest";
import { MAX_COLLECTION_ATTEMPTS, nextBackoff } from "./backoff";

describe("nextBackoff", () => {
  it("doubles from 1 minute, capping at the 64 minute ceiling", () => {
    expect(nextBackoff(0)).toBe(60);
    expect(nextBackoff(1)).toBe(120);
    expect(nextBackoff(2)).toBe(240);
    expect(nextBackoff(3)).toBe(480);
    expect(nextBackoff(4)).toBe(960);
    expect(nextBackoff(5)).toBe(1920);
    expect(nextBackoff(6)).toBe(3840);
  });

  it("stays at the 64 minute ceiling past the point the doubling would exceed it", () => {
    expect(nextBackoff(7)).toBe(3840);
    expect(nextBackoff(100)).toBe(3840);
  });

  it("treats a negative attempt as attempt 0", () => {
    expect(nextBackoff(-1)).toBe(60);
  });

  it("exposes the 8-attempt retry budget (1m,2m,4m,8m,16m,32m,64m,64m) as a named constant", () => {
    expect(MAX_COLLECTION_ATTEMPTS).toBe(8);
  });
});
