import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AdminDashboardClient.tsx"),
  "utf-8",
);

describe("AdminDashboardClient", () => {
  describe("sort event handler (#284)", () => {
    it("reads dir from custom event detail", () => {
      // The chapa:admin-sort handler must read an optional dir from the
      // event detail so the /sort command can specify asc/desc explicitly.
      expect(SOURCE).toMatch(/detail\?\.dir/);
    });

    it("applies dir directly when provided instead of toggling", () => {
      // When dir is provided, setSortDir should be called with it directly,
      // not via the toggle logic.
      expect(SOURCE).toMatch(/setSortDir\(dir\)/);
    });
  });
});
