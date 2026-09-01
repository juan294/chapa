import { describe, expect, it } from "vitest";
import { VERIFICATION_HASH_PATTERN } from "./constants";

describe("VERIFICATION_HASH_PATTERN", () => {
  it.each(["a".repeat(8), "b".repeat(16), "c".repeat(32)])(
    "accepts supported verification code %s",
    (hash) => expect(VERIFICATION_HASH_PATTERN.test(hash)).toBe(true),
  );

  it.each(["a".repeat(7), "A".repeat(8), "g".repeat(32), "a".repeat(33)])(
    "rejects unsupported verification code %s",
    (hash) => expect(VERIFICATION_HASH_PATTERN.test(hash)).toBe(false),
  );
});
