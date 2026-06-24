import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("EmergingPage (server component)", () => {
  it("delegates rendering to ArchetypePage with archetypeKey='emerging'", () => {
    expect(SOURCE).toContain("archetypeKey=\"emerging\"");
  });

  it("does not use force-static (page must be dynamic to read locale cookie)", () => {
    expect(SOURCE).not.toContain("export const dynamic = 'force-static'");
    expect(SOURCE).not.toContain("export const dynamic = 'force-dynamic'");
  });

  it("exports generateMetadata using archetypes.emerging i18n keys", () => {
    expect(SOURCE).toContain("generateMetadata");
    expect(SOURCE).toContain("archetypes.emerging.metadataTitle");
    expect(SOURCE).toContain("archetypes.emerging.metadataDescription");
  });

  it("uses getServerLocale() to detect locale from cookie at request time", () => {
    expect(SOURCE).toContain("getServerLocale");
    expect(SOURCE).not.toContain("DEFAULT_LOCALE");
    expect(SOURCE).toContain("getServerT");
    expect(SOURCE).toContain("@/lib/i18n/server");
  });

  it("imports ArchetypePage from parent _components directory", () => {
    expect(SOURCE).toContain("ArchetypePage");
    expect(SOURCE).toContain("_components/ArchetypePage");
  });
});
