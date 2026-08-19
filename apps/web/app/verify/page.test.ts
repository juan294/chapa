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
// equivalent: route-segment config, and the query-param locale override
// (useSearchParams + LocaleSync + a client-side document.title write) which
// would require simulating a query-string navigation the existing render
// harness doesn't set up.
describe("Verify input page — non-renderable architecture checks", () => {
  describe("static/ISR rendering", () => {
    it("renders from DEFAULT_LOCALE instead of request-time locale APIs", () => {
      expect(SOURCE).toContain('export const dynamic = "force-static"');
      expect(SOURCE).toContain("export const revalidate = 3600");
      expect(SOURCE).toContain("DEFAULT_LOCALE");
      expect(SOURCE).not.toContain("getServerLocale");
    });

    it("does not force dynamic rendering", () => {
      expect(SOURCE).not.toContain("export const dynamic = 'force-dynamic'");
    });
  });

  describe("query-locale override (client-side, not render-harness-observable)", () => {
    it("applies an explicit query locale on the static landing page", () => {
      expect(SOURCE).toContain("useSearchParams");
      expect(SOURCE).toContain('searchParams?.get("lang")');
      expect(SOURCE).toContain("<LocaleSync queryLang=");
    });

    it("keeps the static metadata title coherent with the active locale", () => {
      expect(SOURCE).toContain("document.title =");
      expect(SOURCE).toContain("t('verify.title')");
    });
  });
});
