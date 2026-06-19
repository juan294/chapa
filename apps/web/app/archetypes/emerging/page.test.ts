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

  it("is static/ISR with force-static directive", () => {
    expect(SOURCE).not.toContain("export const dynamic = 'force-dynamic'");
    expect(SOURCE).toContain("export const revalidate");
    expect(SOURCE).toContain("export const dynamic = 'force-static'");
  });

  it("exports generateMetadata using archetypes.emerging i18n keys", () => {
    expect(SOURCE).toContain("generateMetadata");
    expect(SOURCE).toContain("archetypes.emerging.metadataTitle");
    expect(SOURCE).toContain("archetypes.emerging.metadataDescription");
  });

  it("uses DEFAULT_LOCALE for build-time rendering (no getServerLocale)", () => {
    expect(SOURCE).not.toContain("getServerLocale");
    expect(SOURCE).toContain("DEFAULT_LOCALE");
    expect(SOURCE).toContain("getServerT");
    expect(SOURCE).toContain("@/lib/i18n/server");
  });

  it("imports ArchetypePage from parent _components directory", () => {
    expect(SOURCE).toContain("ArchetypePage");
    expect(SOURCE).toContain("_components/ArchetypePage");
  });
});
