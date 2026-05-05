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

  it("exports dynamic = 'force-dynamic' for i18n locale resolution", () => {
    expect(SOURCE).toContain("export const dynamic = 'force-dynamic'");
  });

  it("exports generateMetadata using archetypes.artificer i18n keys", () => {
    expect(SOURCE).toContain("export async function generateMetadata");
    expect(SOURCE).toContain("archetypes.artificer.metadataTitle");
    expect(SOURCE).toContain("archetypes.artificer.metadataDescription");
  });

  it("imports getServerLocale and getServerT from i18n/server", () => {
    expect(SOURCE).toContain("getServerLocale");
    expect(SOURCE).toContain("getServerT");
    expect(SOURCE).toContain("@/lib/i18n/server");
  });

  it("imports ArchetypePage from parent _components directory", () => {
    expect(SOURCE).toContain("ArchetypePage");
    expect(SOURCE).toContain("_components/ArchetypePage");
  });
});
