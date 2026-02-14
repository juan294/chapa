import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "UserMenu.tsx"),
  "utf-8",
);

describe("UserMenu — admin link", () => {
  it("accepts isAdmin prop", () => {
    expect(SOURCE).toContain("isAdmin");
  });

  it("renders Admin Panel link conditionally on isAdmin", () => {
    expect(SOURCE).toContain("{isAdmin && (");
    expect(SOURCE).toContain('href="/admin"');
    expect(SOURCE).toContain("Admin Panel");
  });

  it("Admin Panel section has role=menuitem and aria-hidden icon", () => {
    const start = SOURCE.indexOf("{isAdmin && (");
    const end = SOURCE.indexOf("Admin Panel") + 20;
    const section = SOURCE.slice(start, end);
    expect(section).toContain('role="menuitem"');
    expect(section).toContain('aria-hidden="true"');
  });
});
