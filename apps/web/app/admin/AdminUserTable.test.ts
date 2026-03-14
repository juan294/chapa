import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AdminUserTable.tsx"),
  "utf-8",
);

describe("AdminUserTable", () => {
  describe("rendering", () => {
    it("exports a named AdminUserTable component", () => {
      expect(SOURCE).toContain("export function AdminUserTable");
    });

    it("renders a table element", () => {
      expect(SOURCE).toContain("<table");
    });

    it("renders thead and tbody sections", () => {
      expect(SOURCE).toContain("<thead>");
      expect(SOURCE).toContain("<tbody");
    });
  });

  describe("column headers", () => {
    it("renders Developer column", () => {
      expect(SOURCE).toContain('label="Developer"');
    });

    it("renders Archetype column", () => {
      expect(SOURCE).toContain('label="Archetype"');
    });

    it("renders Tier column", () => {
      expect(SOURCE).toContain('label="Tier"');
    });

    it("renders Score column", () => {
      expect(SOURCE).toContain('label="Score"');
    });

    it("renders Raw column", () => {
      expect(SOURCE).toContain('label="Raw"');
    });

    it("renders Confidence column", () => {
      expect(SOURCE).toContain('label="Conf"');
    });

    it("renders Commits column", () => {
      expect(SOURCE).toContain('label="Commits"');
    });

    it("renders PRs column", () => {
      expect(SOURCE).toContain('label="PRs"');
    });

    it("renders Reviews column", () => {
      expect(SOURCE).toContain('label="Reviews"');
    });

    it("renders Days column", () => {
      expect(SOURCE).toContain('label="Days"');
    });

    it("renders Stars column", () => {
      expect(SOURCE).toContain('label="Stars"');
    });

    it("renders Updated column", () => {
      expect(SOURCE).toContain('label="Updated"');
    });

    it("has an Actions column with sr-only label", () => {
      expect(SOURCE).toContain("sr-only");
      expect(SOURCE).toContain("Actions");
    });
  });

  describe("empty state", () => {
    it("shows search-specific message when search is active", () => {
      expect(SOURCE).toContain("No users match your search.");
    });

    it("shows generic message when no search", () => {
      expect(SOURCE).toContain("No users found.");
    });

    it("uses colSpan for the empty state row", () => {
      expect(SOURCE).toContain("colSpan={13}");
    });
  });

  describe("user rows", () => {
    it("maps over users to render rows", () => {
      expect(SOURCE).toContain("users.map((user)");
    });

    it("uses handle as the row key via AdminUserTableRow", () => {
      expect(SOURCE).toContain("key={user.handle}");
    });

    it("links to the user share page", () => {
      expect(SOURCE).toMatch(/href=\{`\/u\/\$\{user\.handle\}`\}/);
    });

    it("renders avatar with Next Image", () => {
      expect(SOURCE).toContain("<Image");
      expect(SOURCE).toContain("user.avatarUrl");
    });

    it("falls back to initial letter when avatar fails", () => {
      expect(SOURCE).toContain("user.handle.charAt(0).toUpperCase()");
    });

    it("tracks image errors in state", () => {
      expect(SOURCE).toContain("imgErrors");
      expect(SOURCE).toContain("handleImgError");
    });
  });

  describe("users without snapshot data", () => {
    it("dims users with null lastSnapshotDate via opacity", () => {
      expect(SOURCE).toContain("lastSnapshotDate === null");
      expect(SOURCE).toContain("opacity-60");
    });

    it("shows 'no data yet' label for users without snapshots", () => {
      expect(SOURCE).toContain("no data yet");
    });

    it("does not reference statsExpired", () => {
      expect(SOURCE).not.toContain("statsExpired");
    });

    it("does not show 'data expired' label", () => {
      expect(SOURCE).not.toContain("data expired");
    });
  });

  describe("badge SVG link", () => {
    it("links to user badge.svg", () => {
      expect(SOURCE).toMatch(/\/u\/\$\{user\.handle\}\/badge\.svg/);
    });

    it("opens in a new tab", () => {
      expect(SOURCE).toContain('target="_blank"');
      expect(SOURCE).toContain('rel="noopener noreferrer"');
    });

    it("has an accessible label", () => {
      expect(SOURCE).toContain("View badge SVG for");
    });
  });

  describe("memoized row component (#479)", () => {
    it("defines AdminUserTableRow as a named component", () => {
      expect(SOURCE).toContain("const AdminUserTableRow = memo(");
    });

    it("wraps AdminUserTableRow in React.memo", () => {
      expect(SOURCE).toMatch(/memo\(function AdminUserTableRow/);
    });

    it("renders AdminUserTableRow in the users map", () => {
      expect(SOURCE).toContain("<AdminUserTableRow");
    });

    it("passes user, hasImgError, and onImgError props to row", () => {
      expect(SOURCE).toContain("user={user}");
      expect(SOURCE).toContain("hasImgError={imgErrors.has(user.handle)}");
      expect(SOURCE).toContain("onImgError={handleImgError}");
    });
  });

  describe("sort integration", () => {
    it("uses AdminSortableHeader components", () => {
      expect(SOURCE).toContain("<AdminSortableHeader");
    });

    it("passes onSort to header components", () => {
      expect(SOURCE).toContain("onSort={onSort}");
    });

    it("passes sortField and sortDir", () => {
      expect(SOURCE).toContain("sortField={sortField}");
      expect(SOURCE).toContain("sortDir={sortDir}");
    });
  });

  describe("responsive visibility", () => {
    it("hides archetype on small screens", () => {
      expect(SOURCE).toMatch(/field="archetype"[^>]*hidden sm:table-cell/);
    });

    it("hides confidence on small\/medium screens", () => {
      expect(SOURCE).toMatch(/field="confidence"[^>]*hidden md:table-cell/);
    });

    it("hides stats columns on smaller screens", () => {
      expect(SOURCE).toMatch(/field="commitsTotal"[^>]*hidden lg:table-cell/);
      expect(SOURCE).toMatch(/field="prsMergedCount"[^>]*hidden lg:table-cell/);
    });
  });
});
