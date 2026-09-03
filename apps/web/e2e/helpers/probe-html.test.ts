import { describe, it, expect } from "vitest";
import { hasRenderedText, renderedTextPattern, verifyHashFromHtml } from "./probe-html";

// #1279 — the share-verification probe read HTML as a string twice over and
// failed on every deployment: negative assertions matched the serialized
// translation dictionary, and the hash pattern captured 8 of 32 characters.
describe("hasRenderedText", () => {
  const dictionaryOnly =
    '<script>self.__next_f.push(["{\\"notFoundTitle\\":\\"Not found\\",\\"invalidHashTitle\\":\\"Invalid hash\\"}"])</script><h1>Badge verified</h1>';

  it("matches a text node rendered between tags", () => {
    expect(hasRenderedText(dictionaryOnly, "Badge verified")).toBe(true);
  });

  it("does not match the same words inside a serialized dictionary string", () => {
    expect(hasRenderedText(dictionaryOnly, "Not found")).toBe(false);
    expect(hasRenderedText(dictionaryOnly, "Invalid hash")).toBe(false);
  });

  it("matches a rendered not-found or invalid-hash callout", () => {
    expect(hasRenderedText('<p class="x">\n  Not found\n</p>', "Not found")).toBe(true);
    expect(hasRenderedText("<h1>Invalid hash</h1>", "Invalid hash")).toBe(true);
  });

  it("does not treat a longer title as the callout", () => {
    expect(hasRenderedText("<title>Invalid hash — Chapa</title>", "Invalid hash")).toBe(false);
  });

  it("escapes regex metacharacters in the label", () => {
    expect(renderedTextPattern("A (b) c?").test("<span>A (b) c?</span>")).toBe(true);
    expect(renderedTextPattern("A (b) c?").test("<span>A b c</span>")).toBe(false);
  });
});

describe("verifyHashFromHtml", () => {
  const full = "86852ccc3516f34b14f7353de0233167";

  it("captures the whole 32-character hash, not its first 8 characters", () => {
    expect(verifyHashFromHtml(`<a href="/verify/${full}">Verify</a>`)).toBe(full);
  });

  it("accepts the shorter historical hash lengths", () => {
    expect(verifyHashFromHtml('<a href="/verify/0123456789abcdef">x</a>')).toBe("0123456789abcdef");
    expect(verifyHashFromHtml('<a href="/verify/01234567">x</a>')).toBe("01234567");
  });

  it("returns null when the page carries only the bare /verify landing link", () => {
    expect(verifyHashFromHtml('<a href="/verify">Verify a badge</a>')).toBeNull();
  });

  it("takes the first hash link when several are present", () => {
    const html = `<a href="/verify/${full}"></a><a href="https://chapa.thecreativetoken.com/verify/${full}"></a>`;
    expect(verifyHashFromHtml(html)).toBe(full);
  });
});
