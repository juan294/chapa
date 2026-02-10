import { describe, it, expect } from "vitest";
import { escapeXml } from "./escape";

describe("escapeXml", () => {
  it("escapes ampersands", () => {
    expect(escapeXml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes less-than signs", () => {
    expect(escapeXml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes greater-than signs", () => {
    expect(escapeXml("a > b")).toBe("a &gt; b");
  });

  it("escapes single quotes", () => {
    expect(escapeXml("it's")).toBe("it&apos;s");
  });

  it("escapes double quotes", () => {
    expect(escapeXml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes all special characters in a single string", () => {
    expect(escapeXml(`<a href="x" title='y'>&`)).toBe(
      "&lt;a href=&quot;x&quot; title=&apos;y&apos;&gt;&amp;",
    );
  });

  it("returns the same string when no special characters exist", () => {
    expect(escapeXml("hello world 123")).toBe("hello world 123");
  });

  it("handles empty string", () => {
    expect(escapeXml("")).toBe("");
  });
});
