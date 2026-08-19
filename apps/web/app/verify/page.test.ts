import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = [
  fs.readFileSync(path.resolve(__dirname, "page.tsx"), "utf-8"),
  fs.readFileSync(path.resolve(__dirname, "VerifyInputPageClient.tsx"), "utf-8"),
].join("\n");

// #1104: generateMetadata's actual output (title/description/robots), the
// dictionary copy (hash-format instructions, verified-vs-public limits, EN
// and ES), the h1 heading, VerifyForm rendering, and the main-content
// landmark are now covered by real invocation/render+query assertions in
// simple-pages.render.test.tsx. What remains here has no runtime-observable
// equivalent: route-segment config and the client query synchronization leaf.
describe("Verify input page — non-renderable architecture checks", () => {
  describe("request-locale rendering", () => {
    it("resolves metadata and the initial provider from the request locale", () => {
      expect(SOURCE).toContain('export const dynamic = "force-dynamic"');
      expect(SOURCE).toContain("getServerLocale");
      expect(SOURCE).toContain("searchParams");
      expect(SOURCE).toContain("initialLocale={locale}");
    });

    it("does not use static default-locale metadata", () => {
      expect(SOURCE).not.toContain('export const dynamic = "force-static"');
      expect(SOURCE).not.toContain("export const revalidate = 3600");
    });
  });

  describe("query-locale override (client-side, not render-harness-observable)", () => {
    it("applies an explicit query locale on the static landing page", () => {
      expect(SOURCE).toContain("useSearchParams");
      expect(SOURCE).toContain('searchParams?.get("lang")');
      expect(SOURCE).toContain("<LocaleSync queryLang=");
    });

    it("leaves title ownership with request-resolved server metadata", () => {
      expect(SOURCE).not.toContain("document.title =");
    });
  });
});
