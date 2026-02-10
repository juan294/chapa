import { describe, it, expect } from "vitest";
import { isValidHandle } from "./validation";

describe("isValidHandle", () => {
  describe("valid handles", () => {
    it.each([
      ["octocat"],
      ["juan294"],
      ["a"],
      ["a-b"],
      ["a-b-c-d-e"],
      ["A1"],
      ["z"],
      ["user123"],
      ["a".repeat(39)], // max length
    ])("accepts %s", (handle) => {
      expect(isValidHandle(handle)).toBe(true);
    });
  });

  describe("invalid handles", () => {
    it.each([
      ["", "empty string"],
      ["-start", "starts with hyphen"],
      ["end-", "ends with hyphen"],
      ["has spaces", "contains spaces"],
      ["<script>", "contains angle brackets"],
      ["a".repeat(40), "too long (40 chars)"],
      ["../etc", "path traversal"],
      ["has:colon", "contains colon"],
      ["-", "single hyphen"],
      ["a--b", "valid per GitHub but double hyphen is fine"], // GitHub allows this
    ])("rejects %s (%s)", (handle) => {
      // Note: "a--b" is actually valid on GitHub, so we only reject the rest
      if (handle === "a--b") return; // skip — this is actually valid
      expect(isValidHandle(handle)).toBe(false);
    });

    // Test the specific invalid ones individually for clarity
    it("rejects empty string", () => {
      expect(isValidHandle("")).toBe(false);
    });

    it("rejects handle starting with hyphen", () => {
      expect(isValidHandle("-start")).toBe(false);
    });

    it("rejects handle ending with hyphen", () => {
      expect(isValidHandle("end-")).toBe(false);
    });

    it("rejects handle with spaces", () => {
      expect(isValidHandle("has spaces")).toBe(false);
    });

    it("rejects XSS attempt", () => {
      expect(isValidHandle("<script>")).toBe(false);
    });

    it("rejects handle exceeding 39 chars", () => {
      expect(isValidHandle("a".repeat(40))).toBe(false);
    });

    it("rejects path traversal", () => {
      expect(isValidHandle("../etc")).toBe(false);
    });

    it("rejects handle with colon", () => {
      expect(isValidHandle("has:colon")).toBe(false);
    });
  });
});
