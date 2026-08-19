import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AdminDashboardClient.tsx"),
  "utf-8",
);

// Read all admin sub-component sources for tests that check patterns
// which may live in extracted components after the #369 refactor.
function readIfExists(filename: string): string {
  const p = path.resolve(__dirname, filename);
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

const HOOK_SOURCE = readIfExists("useAdminDashboard.ts");

const ALL_ADMIN_SOURCE = [
  SOURCE,
  HOOK_SOURCE,
  readIfExists("AdminSearchBar.tsx"),
  readIfExists("AdminUserTable.tsx"),
  readIfExists("AdminStatsCards.tsx"),
  readIfExists("AdminSortableHeader.tsx"),
].join("\n");

// The bulk of this file used to source-text-match logic that is now
// exercised behaviorally elsewhere:
//   - useAdminDashboard.test.ts (renderHook) covers the hook's public
//     contract end to end: initial state, fetch params, pagination, sort,
//     debounced search, tier counts, and all three custom DOM events
//     (chapa:admin-refresh/-tab/-sort) including the dir-vs-toggle branch.
//   - AdminDashboardClient.render.test.tsx (render + query) covers ARIA
//     tab roles/ids/aria-controls, tab panel wiring, skeleton/error/loading
//     branches per tab, the refresh/pagination controls, the aria-label
//     vs title attribute on the refresh button, and heading hierarchy
//     (h2-not-h1) across the loading/error/dashboard/tab-switch branches.
//   - AdminSortableHeader.render.test.tsx and AdminUserTable.render.test.tsx
//     cover the <th><button>, scope=col, aria-sort, and badge-link
//     aria-label/title assertions via real rendered table markup.
// What's left here is genuinely non-renderable: file-split architecture,
// LOC budgets, import boundaries, a TS-only type union, and a React
// onClick-placement check (synthetic onClick leaves no DOM trace, so
// jsdom can't tell whether a handler sits on <th> vs the <button> inside
// it).
describe("AdminDashboardClient", () => {
  describe("table header keyboard accessibility (#286)", () => {
    it("does not use onClick on <th> elements directly", () => {
      expect(ALL_ADMIN_SOURCE).not.toMatch(/<th[^>]*onClick/);
    });
  });

  describe("skeleton loading state", () => {
    it("does not render the old spinner in loading state", () => {
      // AdminDashboardClient.render.test.tsx mocks AdminTableSkeleton
      // itself, so a stray "animate-spin" remnant from the pre-#skeleton
      // implementation wouldn't surface through that mock — this is the
      // only guard against regressing back to the old spinner markup.
      const loadingBlock = SOURCE.match(
        /\/\/ Loading state[\s\S]*?\/\/ [-]+\s*\n\s*\/\/ Error state/,
      );
      expect(loadingBlock).not.toBeNull();
      expect(loadingBlock![0]).not.toContain("animate-spin");
    });
  });

  describe("component extraction (#369)", () => {
    it("AdminSearchBar exists as a separate file", () => {
      const src = readIfExists("AdminSearchBar.tsx");
      expect(src.length).toBeGreaterThan(0);
    });

    it("AdminUserTable exists as a separate file", () => {
      const src = readIfExists("AdminUserTable.tsx");
      expect(src.length).toBeGreaterThan(0);
    });

    it("AdminStatsCards exists as a separate file", () => {
      const src = readIfExists("AdminStatsCards.tsx");
      expect(src.length).toBeGreaterThan(0);
    });

    it("AdminSortableHeader exists as a separate file", () => {
      const src = readIfExists("AdminSortableHeader.tsx");
      expect(src.length).toBeGreaterThan(0);
    });

    it("useAdminDashboard hook exists as a separate file (#480)", () => {
      expect(HOOK_SOURCE.length).toBeGreaterThan(0);
    });

    it("AdminDashboardClient imports useAdminDashboard hook", () => {
      expect(SOURCE).toMatch(/from\s+["']\.\/useAdminDashboard["']/);
    });

    it("AdminDashboardClient imports sub-components", () => {
      expect(SOURCE).toMatch(/from\s+["']\.\/AdminSearchBar["']/);
      expect(SOURCE).toMatch(/from\s+["']\.\/AdminUserTable["']/);
      expect(SOURCE).toMatch(/from\s+["']\.\/AdminStatsCards["']/);
    });

    it("AdminDashboardClient is under 350 lines after agents tab addition", () => {
      const lines = SOURCE.split("\n").length;
      expect(lines).toBeLessThan(350);
    });

    it("AdminUserTable imports AdminSortableHeader", () => {
      const src = readIfExists("AdminUserTable.tsx");
      expect(src).toMatch(/from\s+["']\.\/AdminSortableHeader["']/);
    });

    it("shared types are exported from a types file", () => {
      const typesSrc = readIfExists("admin-types.ts");
      expect(typesSrc.length).toBeGreaterThan(0);
      expect(typesSrc).toContain("AdminUser");
      expect(typesSrc).toContain("SortField");
      expect(typesSrc).toContain("SortDir");
    });
  });

  describe("tab navigation (#416)", () => {
    it("dynamically imports AgentsDashboard component", () => {
      // A real bundle-splitting check (confirming this doesn't end up in
      // the main chunk) — next/dynamic is mocked away entirely in
      // AdminDashboardClient.render.test.tsx, so that test can't observe
      // whether the import is actually a dynamic one.
      expect(SOURCE).toMatch(/import\(["']\.\/agents\/agents-dashboard["']\)/);
    });

    it("has AdminTab type with 'users', 'agents', 'engagement', and 'campaigns' values", () => {
      // After #480, AdminTab type is defined in useAdminDashboard hook
      // and imported by AdminDashboardClient. TS type union — no runtime
      // footprint a render or hook test can assert on.
      expect(HOOK_SOURCE).toContain(
        'AdminTab = "users" | "agents" | "engagement" | "campaigns"',
      );
    });
  });
});
