import { describe, it, expect } from "vitest";
import { renderJsonLd } from "./jsonld";

describe("renderJsonLd", () => {
  it("serializes a plain object to JSON", () => {
    const result = renderJsonLd({ "@type": "Person", name: "Alice" });
    expect(JSON.parse(result)).toEqual({ "@type": "Person", name: "Alice" });
  });

  it("escapes < to prevent </script> injection", () => {
    const result = renderJsonLd({ value: "</script><script>alert(1)" });
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c/script\\u003e");
  });

  it("escapes > characters", () => {
    const result = renderJsonLd({ value: "a > b" });
    expect(result).not.toContain(">");
    expect(result).toContain("\\u003e");
  });

  it("escapes & characters", () => {
    const result = renderJsonLd({ value: "AT&T" });
    expect(result).not.toContain("&");
    expect(result).toContain("\\u0026");
  });

  it("output is valid JSON after escaping", () => {
    const obj = {
      name: "<Alice & Bob>",
      url: "https://example.com?a=1&b=2",
      description: "x < y > z",
    };
    const result = renderJsonLd(obj);
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("<Alice & Bob>");
    expect(parsed.url).toBe("https://example.com?a=1&b=2");
    expect(parsed.description).toBe("x < y > z");
  });
});
