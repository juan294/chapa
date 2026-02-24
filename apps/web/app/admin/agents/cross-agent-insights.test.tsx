import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./cross-agent-insights";

describe("renderMarkdown", () => {
  describe("HTML escaping", () => {
    it("escapes <script> tags in heading content", () => {
      const result = renderMarkdown("## <script>alert('xss')</script>");
      expect(result).toContain("&lt;script&gt;");
      expect(result).toContain("&lt;/script&gt;");
      expect(result).not.toContain("<script>");
      // Should still be wrapped in an h3
      expect(result).toContain("<h3");
      expect(result).toContain("</h3>");
    });

    it("escapes HTML entities in bullet list items", () => {
      const result = renderMarkdown("- Item with <img onerror=alert(1)>");
      expect(result).toContain("&lt;img onerror=alert(1)&gt;");
      expect(result).not.toContain("<img");
      expect(result).toContain("<li");
    });

    it("escapes HTML entities in regular text", () => {
      const result = renderMarkdown("Hello <b>world</b> & friends");
      expect(result).toContain("&lt;b&gt;");
      expect(result).toContain("&lt;/b&gt;");
      expect(result).toContain("&amp;");
      expect(result).toContain("<p");
    });

    it("escapes ampersands", () => {
      const result = renderMarkdown("A & B");
      expect(result).toContain("&amp;");
    });

    it("escapes double quotes", () => {
      const result = renderMarkdown('She said "hello"');
      expect(result).toContain("&quot;");
    });

    it("escapes single quotes", () => {
      const result = renderMarkdown("it's working");
      expect(result).toContain("&#39;");
    });

    it("escapes HTML in h1 headings", () => {
      const result = renderMarkdown("# <div>heading</div>");
      expect(result).toContain("<h2");
      expect(result).toContain("&lt;div&gt;");
      expect(result).not.toContain("<div>");
    });

    it("escapes HTML in bold text inside bullets", () => {
      const result = renderMarkdown("- **<script>bold xss</script>**");
      expect(result).toContain("&lt;script&gt;");
      expect(result).toContain("<strong");
    });

    it("escapes HTML in inline code content", () => {
      const result = renderMarkdown("- Use `<script>` carefully");
      expect(result).toContain("&lt;script&gt;");
      expect(result).toContain("<code");
    });
  });

  describe("markdown rendering", () => {
    it("renders ## as h3", () => {
      const result = renderMarkdown("## Hello World");
      expect(result).toContain("<h3");
      expect(result).toContain("Hello World");
      expect(result).toContain("</h3>");
    });

    it("renders # as h2", () => {
      const result = renderMarkdown("# Title");
      expect(result).toContain("<h2");
      expect(result).toContain("Title");
      expect(result).toContain("</h2>");
    });

    it("renders bullet items as li", () => {
      const result = renderMarkdown("- First item");
      expect(result).toContain("<li");
      expect(result).toContain("First item");
      expect(result).toContain("</li>");
    });

    it("renders bold text with strong tags", () => {
      const result = renderMarkdown("- This is **bold** text");
      expect(result).toContain("<strong");
      expect(result).toContain("bold");
      expect(result).toContain("</strong>");
    });

    it("renders inline code with code tags", () => {
      const result = renderMarkdown("- Use `npm install`");
      expect(result).toContain("<code");
      expect(result).toContain("npm install");
      expect(result).toContain("</code>");
    });

    it("renders regular text as p", () => {
      const result = renderMarkdown("Just some text");
      expect(result).toContain("<p");
      expect(result).toContain("Just some text");
      expect(result).toContain("</p>");
    });

    it("skips empty lines", () => {
      const result = renderMarkdown("Line 1\n\nLine 2");
      expect(result).toContain("Line 1");
      expect(result).toContain("Line 2");
    });

    it("handles multi-line markdown", () => {
      const input = "## Status\n- **OK**: All good\n- Check `env`\n\nDone.";
      const result = renderMarkdown(input);
      expect(result).toContain("<h3");
      expect(result).toContain("<li");
      expect(result).toContain("<strong");
      expect(result).toContain("<code");
      expect(result).toContain("<p");
    });
  });
});
