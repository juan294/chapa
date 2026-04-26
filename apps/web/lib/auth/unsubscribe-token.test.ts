import { describe, expect, it } from "vitest";
import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./unsubscribe-token";

const SECRET = "test-secret-do-not-use-in-prod";

describe("unsubscribe-token", () => {
  it("verifies a token generated for the same handle and secret", () => {
    const token = generateUnsubscribeToken("juan294", SECRET);
    expect(verifyUnsubscribeToken("juan294", token, SECRET)).toBe(true);
  });

  it("normalizes handle case during both generation and verification", () => {
    const token = generateUnsubscribeToken("Juan294", SECRET);
    expect(verifyUnsubscribeToken("JUAN294", token, SECRET)).toBe(true);
  });

  it("rejects a token signed for a different handle", () => {
    const token = generateUnsubscribeToken("juan294", SECRET);
    expect(verifyUnsubscribeToken("attacker", token, SECRET)).toBe(false);
  });

  it("rejects a token verified with a different secret", () => {
    const token = generateUnsubscribeToken("juan294", SECRET);
    expect(verifyUnsubscribeToken("juan294", token, "wrong-secret")).toBe(false);
  });

  it("rejects an empty token", () => {
    expect(verifyUnsubscribeToken("juan294", "", SECRET)).toBe(false);
  });

  it("rejects a token without a dot separator", () => {
    expect(verifyUnsubscribeToken("juan294", "no-dot-here", SECRET)).toBe(false);
  });

  it("rejects a token with a missing signature segment", () => {
    expect(verifyUnsubscribeToken("juan294", "anything.", SECRET)).toBe(false);
  });

  it("rejects a token whose signature has the wrong length", () => {
    const token = generateUnsubscribeToken("juan294", SECRET);
    const dot = token.indexOf(".");
    const truncated = `${token.slice(0, dot)}.deadbeef`;
    expect(verifyUnsubscribeToken("juan294", truncated, SECRET)).toBe(false);
  });

  it("rejects a token whose signature has the right length but wrong bytes", () => {
    const token = generateUnsubscribeToken("juan294", SECRET);
    const dot = token.indexOf(".");
    const sig = token.slice(dot + 1);
    const tampered = `${token.slice(0, dot)}.${"A".repeat(sig.length)}`;
    expect(verifyUnsubscribeToken("juan294", tampered, SECRET)).toBe(false);
  });
});
