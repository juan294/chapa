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

describe("AdminDashboardClient", () => {
  describe("sort event handler (#284)", () => {
    it("reads dir from custom event detail", () => {
      // The chapa:admin-sort handler must read an optional dir from the
      // event detail so the /sort command can specify asc/desc explicitly.
      // After #480, this logic lives in useAdminDashboard hook.
      expect(HOOK_SOURCE).toMatch(/detail\?\.dir/);
    });

    it("applies dir directly when provided instead of toggling", () => {
      // When dir is provided, setSortDir should be called with it directly,
      // not via the toggle logic.
      expect(HOOK_SOURCE).toMatch(/setSortDir\(dir\)/);
    });
  });

  describe("table header keyboard accessibility (#286)", () => {
    it("wraps sort text in <button> elements inside <th>", () => {
      // Each sortable <th> should contain a <button> for keyboard access
      expect(ALL_ADMIN_SOURCE).toMatch(/<th[^>]*>\s*<button/);
    });

    it("does not use onClick on <th> elements directly", () => {
      // onClick should be on the <button> inside <th>, not on <th> itself
      expect(ALL_ADMIN_SOURCE).not.toMatch(/<th[^>]*onClick/);
    });

    it("all <th> elements have scope='col'", () => {
      // Every <th> in the table header must have scope="col"
      const thMatches = ALL_ADMIN_SOURCE.match(/<th\b[^>]*>/g) ?? [];
      expect(thMatches.length).toBeGreaterThan(0);
      for (const th of thMatches) {
        expect(th).toContain('scope="col"');
      }
    });

    it("sorted column has aria-sort attribute", () => {
      // The currently sorted column should declare aria-sort
      expect(ALL_ADMIN_SOURCE).toMatch(/aria-sort/);
    });
  });

  describe("a11y: badge link aria-label (#334)", () => {
    it("uses aria-label on the badge SVG link", () => {
      expect(ALL_ADMIN_SOURCE).toContain("aria-label={`View badge SVG for ${user.handle}`}");
    });

    it("keeps title for tooltip", () => {
      expect(ALL_ADMIN_SOURCE).toContain('title="View badge SVG"');
    });
  });

  describe("a11y: heading hierarchy — h2 in client component (#465)", () => {
    it("loading state contains an <h2> (not <h1>) element", () => {
      // The page-level <h1> lives in page.tsx (sr-only). The client
      // component must use <h2> to avoid duplicate h1 landmarks.
      const loadingBlock = SOURCE.match(
        /\/\/ Loading state[\s\S]*?\/\/ [-]+\s*\n\s*\/\/ Error state/,
      );
      expect(loadingBlock).not.toBeNull();
      expect(loadingBlock![0]).toMatch(/<h2[\s>]/);
      expect(loadingBlock![0]).not.toMatch(/<h1[\s>]/);
    });

    it("error state contains an <h2> (not <h1>) element", () => {
      const errorBlock = SOURCE.match(
        /\/\/ Error state[\s\S]*?\/\/ [-]+\s*\n\s*\/\/ Dashboard/,
      );
      expect(errorBlock).not.toBeNull();
      expect(errorBlock![0]).toMatch(/<h2[\s>]/);
      expect(errorBlock![0]).not.toMatch(/<h1[\s>]/);
    });

    it("main dashboard view contains an <h2> (not <h1>) element", () => {
      const dashboardBlock = SOURCE.match(
        /\/\/ Dashboard[\s\S]*$/,
      );
      expect(dashboardBlock).not.toBeNull();
      expect(dashboardBlock![0]).toMatch(/<h2[\s>]/);
      expect(dashboardBlock![0]).not.toMatch(/<h1[\s>]/);
    });

    it("loading and error h2 use font-heading class", () => {
      const loadingBlock = SOURCE.match(
        /\/\/ Loading state[\s\S]*?\/\/ [-]+\s*\n\s*\/\/ Error state/,
      );
      const errorBlock = SOURCE.match(
        /\/\/ Error state[\s\S]*?\/\/ [-]+\s*\n\s*\/\/ Dashboard/,
      );
      expect(loadingBlock).not.toBeNull();
      expect(errorBlock).not.toBeNull();

      const loadingH2 = loadingBlock![0].match(/<h2[^>]*>/);
      const errorH2 = errorBlock![0].match(/<h2[^>]*>/);
      expect(loadingH2).not.toBeNull();
      expect(errorH2).not.toBeNull();
      expect(loadingH2![0]).toContain("font-heading");
      expect(errorH2![0]).toContain("font-heading");
    });

    it("no <h1> tags exist anywhere in AdminDashboardClient", () => {
      // The only h1 should be the sr-only one in page.tsx, not here.
      expect(SOURCE).not.toMatch(/<h1[\s>]/);
    });
  });

  describe("a11y: refresh button (#306)", () => {
    it("uses aria-label instead of title on the refresh button", () => {
      // The refresh button should use aria-label for screen reader text,
      // not title which is inconsistently read by screen readers.
      // Find the refresh button block (the one that calls fetchUsers(true))
      const refreshBtnMatch = SOURCE.match(/<button[\s\S]*?fetchUsers\(true\)[\s\S]*?>/);
      expect(refreshBtnMatch).not.toBeNull();
      const refreshBtn = refreshBtnMatch![0];
      expect(refreshBtn).toContain('aria-label=');
      expect(refreshBtn).not.toContain('title=');
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
      expect(SOURCE).toMatch(/import\(["']\.\/agents\/agents-dashboard["']\)/);
    });

    it("has AdminTab type with 'users', 'agents', and 'engagement' values", () => {
      // After #480, AdminTab type is defined in useAdminDashboard hook
      // and imported by AdminDashboardClient.
      expect(HOOK_SOURCE).toContain('AdminTab = "users" | "agents" | "engagement"');
    });

    it("renders tab buttons for Users and Agents", () => {
      // After ARIA fix, tab buttons should not be wrapped in </button>
      // They use role="tab" on <button> elements
      expect(SOURCE).toContain("Users");
      expect(SOURCE).toContain("Agents");
    });

    it("renders AgentsDashboard when agents tab is active", () => {
      expect(SOURCE).toContain("<AgentsDashboard");
    });

    it("listens for chapa:admin-tab events", () => {
      // After #480, event listeners live in useAdminDashboard hook
      expect(HOOK_SOURCE).toContain("chapa:admin-tab");
    });

    it("uses amber border for active tab styling", () => {
      expect(SOURCE).toContain("border-amber text-amber");
    });
  });

  describe("a11y: ARIA tab roles (#421)", () => {
    it("tab container has role='tablist'", () => {
      expect(SOURCE).toContain('role="tablist"');
    });

    it("tab buttons have role='tab'", () => {
      expect(SOURCE).toContain('role="tab"');
    });

    it("tab buttons have aria-selected attribute", () => {
      // Each tab button should indicate whether it is the active tab
      expect(SOURCE).toMatch(/aria-selected=\{activeTab === /);
    });

    it("tab buttons have aria-controls pointing to panel id", () => {
      expect(SOURCE).toContain('aria-controls="tabpanel-');
    });

    it("tab buttons have unique id attributes", () => {
      expect(SOURCE).toContain('id="tab-users"');
      expect(SOURCE).toContain('id="tab-agents"');
    });

    it("tab panel has role='tabpanel'", () => {
      expect(SOURCE).toContain('role="tabpanel"');
    });

    it("tab panel has id matching aria-controls", () => {
      expect(SOURCE).toContain('id="tabpanel-users"');
      expect(SOURCE).toContain('id="tabpanel-agents"');
    });

    it("tab panel has aria-labelledby pointing to the active tab", () => {
      expect(SOURCE).toContain('aria-labelledby="tab-users"');
      expect(SOURCE).toContain('aria-labelledby="tab-agents"');
    });

    it("tab bar is defined as a reusable variable used across all render branches", () => {
      // The tabBar JSX variable is defined once with role="tablist" and
      // referenced in loading, error, and dashboard return statements via {tabBar}.
      expect(SOURCE).toContain('role="tablist"');
      const tabBarRefs = SOURCE.match(/\{tabBar\}/g) ?? [];
      expect(tabBarRefs.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("skeleton loading state", () => {
    it("imports AdminTableSkeleton", () => {
      expect(SOURCE).toMatch(/from\s+["']\.\/AdminTableSkeleton["']/);
    });

    it("renders AdminTableSkeleton in loading state", () => {
      const loadingBlock = SOURCE.match(
        /\/\/ Loading state[\s\S]*?\/\/ [-]+\s*\n\s*\/\/ Error state/,
      );
      expect(loadingBlock).not.toBeNull();
      expect(loadingBlock![0]).toContain("<AdminTableSkeleton");
    });

    it("does not render the old spinner in loading state", () => {
      const loadingBlock = SOURCE.match(
        /\/\/ Loading state[\s\S]*?\/\/ [-]+\s*\n\s*\/\/ Error state/,
      );
      expect(loadingBlock).not.toBeNull();
      expect(loadingBlock![0]).not.toContain("animate-spin");
    });

    it("has aria-live announcement in loading state", () => {
      const loadingBlock = SOURCE.match(
        /\/\/ Loading state[\s\S]*?\/\/ [-]+\s*\n\s*\/\/ Error state/,
      );
      expect(loadingBlock).not.toBeNull();
      expect(loadingBlock![0]).toContain('aria-live="polite"');
    });
  });

  describe("deferred search", () => {
    it("uses useDebouncedValue in the hook", () => {
      // After #993, useDeferredValue (render-priority only, not network throttling)
      // was replaced with a real debounce to stop a fetch firing per keystroke.
      expect(HOOK_SOURCE).toMatch(/useDebouncedValue/);
    });

    it("creates deferredSearch from debounced search state", () => {
      expect(HOOK_SOURCE).toMatch(/useDebouncedValue\(search,/);
    });

    it("uses deferredSearch in server-side fetch params", () => {
      // After server-side migration, deferredSearch is sent as a query param
      expect(HOOK_SOURCE).toContain("deferredSearch");
    });
  });

  describe("useAdminDashboard hook (#480)", () => {
    it("exports useAdminDashboard as a named function", () => {
      expect(HOOK_SOURCE).toContain("export function useAdminDashboard");
    });

    it("exports AdminTab type", () => {
      expect(HOOK_SOURCE).toContain("export type AdminTab");
    });

    it("exports AdminDashboardState interface", () => {
      expect(HOOK_SOURCE).toContain("export interface AdminDashboardState");
    });

    it("manages users state", () => {
      expect(HOOK_SOURCE).toMatch(/useState<AdminUser\[\]>/);
    });

    it("manages loading state", () => {
      expect(HOOK_SOURCE).toContain("useState(true)");
    });

    it("manages sort state", () => {
      expect(HOOK_SOURCE).toMatch(/useState<SortField>/);
      expect(HOOK_SOURCE).toMatch(/useState<SortDir>/);
    });

    it("defines fetchUsers callback", () => {
      expect(HOOK_SOURCE).toContain("const fetchUsers = useCallback");
    });

    it("defines handleSort callback", () => {
      expect(HOOK_SOURCE).toContain("const handleSort = useCallback");
    });

    it("listens for chapa:admin-refresh events", () => {
      expect(HOOK_SOURCE).toContain("chapa:admin-refresh");
    });

    it("listens for chapa:admin-sort events", () => {
      expect(HOOK_SOURCE).toContain("chapa:admin-sort");
    });

    it("computes tierCounts from current page users", () => {
      expect(HOOK_SOURCE).toContain("const tierCounts = useMemo");
    });

    it("does not use client-side filtered or sorted memos", () => {
      expect(HOOK_SOURCE).not.toContain("const filtered = useMemo");
      expect(HOOK_SOURCE).not.toContain("const sorted = useMemo");
    });

    it("manages pagination state", () => {
      expect(HOOK_SOURCE).toContain("useState(1)"); // page
      expect(HOOK_SOURCE).toContain("setTotal");
      expect(HOOK_SOURCE).toContain("setTotalPages");
    });

    it("returns all necessary state and handlers", () => {
      // Check the return statement includes key fields
      expect(HOOK_SOURCE).toMatch(/return\s*\{[\s\S]*activeTab[\s\S]*\}/);
      expect(HOOK_SOURCE).toMatch(/return\s*\{[\s\S]*fetchUsers[\s\S]*\}/);
      expect(HOOK_SOURCE).toMatch(/return\s*\{[\s\S]*handleSort[\s\S]*\}/);
      expect(HOOK_SOURCE).toMatch(/return\s*\{[\s\S]*page[\s\S]*\}/);
      expect(HOOK_SOURCE).toMatch(/return\s*\{[\s\S]*total[\s\S]*\}/);
      expect(HOOK_SOURCE).toMatch(/return\s*\{[\s\S]*tierCounts[\s\S]*\}/);
    });
  });
});
