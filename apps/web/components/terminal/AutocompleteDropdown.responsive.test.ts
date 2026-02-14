import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AutocompleteDropdown.tsx"),
  "utf-8",
);

describe("AutocompleteDropdown", () => {
  describe("mobile responsiveness (#240)", () => {
    it("container uses reduced mobile height (max-h-48 sm:max-h-64)", () => {
      expect(SOURCE).toContain("max-h-48 sm:max-h-64");
    });

    it("usage hints span uses hidden sm:inline to hide on mobile", () => {
      expect(SOURCE).toContain("hidden sm:inline");
    });
  });
});
