import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

// Everything else that used to live here (default-export shape, "use
// client" absence, i18n key usage, session/auth flow, design-system
// classes, imports) is now exercised behaviorally by page.render.test.tsx
// (which renders the real component through every branch and queries the
// DOM/props) and page.metadata.test.ts (which calls generateMetadata
// directly and asserts on its return value). `dynamic = 'force-dynamic'`
// is a Next.js route-segment config value with no runtime/DOM footprint a
// render test can observe, so it stays as a source check.
describe("CliAuthorizePage", () => {
  it("exports dynamic = force-dynamic", () => {
    expect(SOURCE).toContain("export const dynamic = 'force-dynamic'");
  });
});
