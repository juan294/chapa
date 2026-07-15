import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("ArtificerPage (server component)", () => {
  it("delegates rendering to ArchetypePage with archetypeKey='artificer'", () => {
    expect(SOURCE).toContain("archetypeKey=\"artificer\"");
  });

  it("forces static rendering with hourly revalidation", () => {
    expect(SOURCE).toContain("export const dynamic = 'force-static'");
    expect(SOURCE).toContain("export const revalidate = 3600");
    expect(SOURCE).not.toContain("export const dynamic = 'force-dynamic'");
  });

  it("exports generateMetadata using archetypes.artificer i18n keys", () => {
    expect(SOURCE).toContain("generateMetadata");
    expect(SOURCE).toContain("archetypes.artificer.metadataTitle");
    expect(SOURCE).toContain("archetypes.artificer.metadataDescription");
  });

  // #1023 (FE-H1) — locale now comes from the route's [locale] segment
  // param (populated by proxy.ts), not a build-time DEFAULT_LOCALE
  // constant or a request-time getServerLocale() cookie/header read.
  it("uses getServerT() with the [locale] route param", () => {
    expect(SOURCE).not.toContain("DEFAULT_LOCALE");
    expect(SOURCE).not.toContain("getServerLocale");
    expect(SOURCE).toContain("getServerT");
    expect(SOURCE).toContain("@/lib/i18n/server");
    expect(SOURCE).toContain("params");
  });

  it("imports ArchetypePage from parent _components directory", () => {
    expect(SOURCE).toContain("ArchetypePage");
    expect(SOURCE).toContain("_components/ArchetypePage");
  });
});
