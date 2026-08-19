// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { AdminDashboardState, AdminTab } from "./useAdminDashboard";

// ---------------------------------------------------------------------------
// Default mock state factory
// ---------------------------------------------------------------------------

function createMockState(overrides: Partial<AdminDashboardState> = {}): AdminDashboardState {
  return {
    activeTab: "users" as AdminTab,
    setActiveTab: vi.fn(),
    users: [],
    loading: false,
    error: null,
    search: "",
    setSearch: vi.fn(),
    deferredSearch: "",
    sortField: "adjustedComposite",
    sortDir: "desc",
    refreshing: false,
    lastRefreshed: null,
    fetchUsers: vi.fn(),
    handleSort: vi.fn(),
    tierCounts: { Elite: 0, High: 0, Solid: 0, Emerging: 0 },
    setError: vi.fn(),
    setLoading: vi.fn(),
    page: 1,
    setPage: vi.fn(),
    total: 0,
    totalPages: 1,
    limit: 25,
    ...overrides,
  };
}

let mockState: AdminDashboardState;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("./useAdminDashboard", () => ({
  useAdminDashboard: () => mockState,
}));

vi.mock("./admin-types", () => ({
  formatDate: (iso: string) => `formatted:${iso}`,
}));

vi.mock("./AdminSearchBar", () => ({
  AdminSearchBar: (props: { search: string; resultCount: number }) => (
    <div data-testid="admin-search-bar" data-search={props.search} data-count={props.resultCount} />
  ),
}));

vi.mock("./AdminStatsCards", () => ({
  AdminStatsCards: (props: { totalUsers: number; pageUsers: number }) => (
    <div
      data-testid="admin-stats-cards"
      data-total={props.totalUsers}
      data-page={props.pageUsers}
    />
  ),
}));

vi.mock("./AdminUserTable", () => ({
  AdminUserTable: () => <div data-testid="admin-user-table" />,
}));

vi.mock("./AdminTableSkeleton", () => ({
  AdminTableSkeleton: () => <div data-testid="admin-table-skeleton" />,
}));

vi.mock("next/dynamic", () => ({
  default: (_loader: () => Promise<{ default: React.ComponentType }>, opts?: { loading?: () => React.ReactNode }) => {
    // Return a component that just renders a testid based on the loading fallback text
    const fallback = opts?.loading?.();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = ((fallback as any)?.props?.children as string) ?? "dynamic";
    const id = text.toLowerCase().replace(/\s+/g, "-").replace(/\.\.\.$/, "");
    return function DynamicMock() {
      return <div data-testid={`dynamic-${id}`}>{text}</div>;
    };
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockState = createMockState();
});

afterEach(() => {
  cleanup();
});

// Import AFTER mocks are set up
import { AdminDashboardClient } from "./AdminDashboardClient";

describe("AdminDashboardClient", () => {
  // ─── Tab bar ──────────────────────────────────────────────────────────

  describe("tab bar", () => {
    it("renders 4 tab buttons with correct labels", () => {
      render(<AdminDashboardClient />);
      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(4);
      expect(tabs[0]!.textContent).toBe("Users");
      expect(tabs[1]!.textContent).toBe("Agents");
      expect(tabs[2]!.textContent).toBe("Engagement");
      expect(tabs[3]!.textContent).toBe("Campaigns");
    });

    it("marks the active tab with aria-selected=true", () => {
      render(<AdminDashboardClient />);
      const usersTab = screen.getByRole("tab", { name: "Users" });
      expect(usersTab.getAttribute("aria-selected")).toBe("true");

      const agentsTab = screen.getByRole("tab", { name: "Agents" });
      expect(agentsTab.getAttribute("aria-selected")).toBe("false");
    });

    it("calls setActiveTab when a tab is clicked", () => {
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByRole("tab", { name: "Agents" }));
      expect(mockState.setActiveTab).toHaveBeenCalledWith("agents");
    });

    it("tab bar has role=tablist with aria-label", () => {
      render(<AdminDashboardClient />);
      const tablist = screen.getByRole("tablist");
      expect(tablist.getAttribute("aria-label")).toBe("Admin sections");
    });

    it("tab buttons have unique ids and aria-controls pointing to their panel", () => {
      render(<AdminDashboardClient />);
      const usersTab = screen.getByRole("tab", { name: "Users" });
      expect(usersTab.getAttribute("id")).toBe("tab-users");
      expect(usersTab.getAttribute("aria-controls")).toBe("tabpanel-users");

      const agentsTab = screen.getByRole("tab", { name: "Agents" });
      expect(agentsTab.getAttribute("id")).toBe("tab-agents");
      expect(agentsTab.getAttribute("aria-controls")).toBe("tabpanel-agents");
    });
  });

  // ─── Loading state ────────────────────────────────────────────────────

  describe("loading state (users tab)", () => {
    it("shows skeleton when loading and activeTab is users", () => {
      mockState = createMockState({ loading: true, activeTab: "users" });
      render(<AdminDashboardClient />);
      expect(screen.getByTestId("admin-table-skeleton")).toBeDefined();
    });

    it("has aria-live loading announcement", () => {
      mockState = createMockState({ loading: true, activeTab: "users" });
      render(<AdminDashboardClient />);
      const liveRegion = screen.getByText("Loading user data");
      expect(liveRegion.getAttribute("aria-live")).toBe("polite");
    });

    it("does not show skeleton when loading but activeTab is agents", () => {
      mockState = createMockState({ loading: true, activeTab: "agents" });
      render(<AdminDashboardClient />);
      expect(screen.queryByTestId("admin-table-skeleton")).toBeNull();
    });
  });

  // ─── Error state ──────────────────────────────────────────────────────

  describe("error state (users tab)", () => {
    it("shows error message when error is set", () => {
      mockState = createMockState({ error: "Something went wrong", activeTab: "users" });
      render(<AdminDashboardClient />);
      expect(screen.getByText("Something went wrong")).toBeDefined();
    });

    it("renders a Retry button", () => {
      mockState = createMockState({ error: "Failed to load", activeTab: "users" });
      render(<AdminDashboardClient />);
      expect(screen.getByText("Retry")).toBeDefined();
    });

    it("Retry button calls setError(null), setLoading(true), and fetchUsers()", () => {
      mockState = createMockState({ error: "Failed to load", activeTab: "users" });
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByText("Retry"));
      expect(mockState.setError).toHaveBeenCalledWith(null);
      expect(mockState.setLoading).toHaveBeenCalledWith(true);
      expect(mockState.fetchUsers).toHaveBeenCalled();
    });

    it("does not show error when activeTab is not users", () => {
      mockState = createMockState({ error: "Failed to load", activeTab: "agents" });
      render(<AdminDashboardClient />);
      expect(screen.queryByText("Failed to load")).toBeNull();
    });
  });

  // ─── Users tab content ────────────────────────────────────────────────

  describe("users tab content", () => {
    it("shows singular developer count for total=1", () => {
      mockState = createMockState({ total: 1 });
      render(<AdminDashboardClient />);
      expect(screen.getByText(/1 developer(?!s)/)).toBeDefined();
    });

    it("shows plural developers count for total>1", () => {
      mockState = createMockState({ total: 42 });
      render(<AdminDashboardClient />);
      expect(screen.getByText("42 developers", { exact: false })).toBeDefined();
    });

    it("renders AdminStatsCards", () => {
      mockState = createMockState({ total: 10 });
      render(<AdminDashboardClient />);
      expect(screen.getByTestId("admin-stats-cards")).toBeDefined();
    });

    it("renders AdminSearchBar", () => {
      render(<AdminDashboardClient />);
      expect(screen.getByTestId("admin-search-bar")).toBeDefined();
    });

    it("renders AdminUserTable", () => {
      render(<AdminDashboardClient />);
      expect(screen.getByTestId("admin-user-table")).toBeDefined();
    });

    it("shows last refreshed time when available", () => {
      mockState = createMockState({
        total: 5,
        lastRefreshed: new Date("2026-03-22T10:00:00Z"),
      });
      render(<AdminDashboardClient />);
      // formatDate is mocked to return "formatted:<iso>"
      expect(screen.getByText(/formatted:/, { exact: false })).toBeDefined();
    });

    it("shows users tab panel with correct aria-labelledby", () => {
      render(<AdminDashboardClient />);
      const panel = screen.getByRole("tabpanel");
      expect(panel.getAttribute("id")).toBe("tabpanel-users");
      expect(panel.getAttribute("aria-labelledby")).toBe("tab-users");
    });
  });

  // ─── Heading hierarchy (a11y, #465) ─────────────────────────────────────
  // The page-level <h1> lives in page.tsx (sr-only); this client component
  // must use <h2> in every branch to avoid a duplicate h1 landmark.

  describe("heading hierarchy", () => {
    it("loading state uses an h2 (not h1) with font-heading", () => {
      mockState = createMockState({ loading: true, activeTab: "users" });
      render(<AdminDashboardClient />);
      expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0);
      const headings = screen.getAllByRole("heading", { level: 2 });
      expect(headings.length).toBeGreaterThan(0);
      expect(headings.some((h) => h.className.includes("font-heading"))).toBe(true);
    });

    it("error state uses an h2 (not h1) with font-heading", () => {
      mockState = createMockState({ error: "Failed to load", activeTab: "users" });
      render(<AdminDashboardClient />);
      expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0);
      const headings = screen.getAllByRole("heading", { level: 2 });
      expect(headings.length).toBeGreaterThan(0);
      expect(headings.some((h) => h.className.includes("font-heading"))).toBe(true);
    });

    it("main dashboard view uses an h2 (not h1)", () => {
      render(<AdminDashboardClient />);
      expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0);
      expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
    });

    it("never renders an h1 across tabs", () => {
      for (const activeTab of ["agents", "engagement", "campaigns"] as const) {
        mockState = createMockState({ activeTab });
        const { unmount } = render(<AdminDashboardClient />);
        expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0);
        unmount();
      }
    });
  });

  // ─── Refresh button ───────────────────────────────────────────────────

  describe("refresh button", () => {
    it("renders refresh button with aria-label", () => {
      render(<AdminDashboardClient />);
      expect(screen.getByLabelText("Refresh data")).toBeDefined();
    });

    it("uses aria-label instead of a title attribute", () => {
      render(<AdminDashboardClient />);
      const button = screen.getByLabelText("Refresh data");
      expect(button.hasAttribute("title")).toBe(false);
    });

    it("calls fetchUsers(true) on click", () => {
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByLabelText("Refresh data"));
      expect(mockState.fetchUsers).toHaveBeenCalledWith(true);
    });

    it("shows 'Refreshing...' when refreshing is true", () => {
      mockState = createMockState({ refreshing: true });
      render(<AdminDashboardClient />);
      expect(screen.getByText("Refreshing...")).toBeDefined();
    });

    it("shows 'Refresh' when not refreshing", () => {
      render(<AdminDashboardClient />);
      expect(screen.getByText("Refresh")).toBeDefined();
    });

    it("is disabled when refreshing", () => {
      mockState = createMockState({ refreshing: true });
      render(<AdminDashboardClient />);
      const button = screen.getByLabelText("Refresh data");
      expect(button.hasAttribute("disabled")).toBe(true);
    });
  });

  // ─── Pagination ───────────────────────────────────────────────────────

  describe("pagination", () => {
    it("does not render pagination when totalPages <= 1", () => {
      mockState = createMockState({ totalPages: 1 });
      render(<AdminDashboardClient />);
      expect(screen.queryByLabelText("Previous page")).toBeNull();
      expect(screen.queryByLabelText("Next page")).toBeNull();
    });

    it("renders Previous and Next buttons when totalPages > 1", () => {
      mockState = createMockState({ totalPages: 3, page: 2, total: 75, limit: 25 });
      render(<AdminDashboardClient />);
      expect(screen.getByLabelText("Previous page")).toBeDefined();
      expect(screen.getByLabelText("Next page")).toBeDefined();
    });

    it("Previous is disabled on first page", () => {
      mockState = createMockState({ totalPages: 3, page: 1, total: 75, limit: 25 });
      render(<AdminDashboardClient />);
      const prev = screen.getByLabelText("Previous page");
      expect(prev.hasAttribute("disabled")).toBe(true);
    });

    it("Next is disabled on last page", () => {
      mockState = createMockState({ totalPages: 3, page: 3, total: 75, limit: 25 });
      render(<AdminDashboardClient />);
      const next = screen.getByLabelText("Next page");
      expect(next.hasAttribute("disabled")).toBe(true);
    });

    it("Previous and Next are enabled on middle page", () => {
      mockState = createMockState({ totalPages: 3, page: 2, total: 75, limit: 25 });
      render(<AdminDashboardClient />);
      expect(screen.getByLabelText("Previous page").hasAttribute("disabled")).toBe(false);
      expect(screen.getByLabelText("Next page").hasAttribute("disabled")).toBe(false);
    });

    it("clicking Previous calls setPage(page - 1)", () => {
      mockState = createMockState({ totalPages: 3, page: 2, total: 75, limit: 25 });
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByLabelText("Previous page"));
      expect(mockState.setPage).toHaveBeenCalledWith(1);
    });

    it("clicking Next calls setPage(page + 1)", () => {
      mockState = createMockState({ totalPages: 3, page: 2, total: 75, limit: 25 });
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByLabelText("Next page"));
      expect(mockState.setPage).toHaveBeenCalledWith(3);
    });

    it("shows page info text", () => {
      mockState = createMockState({ totalPages: 3, page: 2, total: 75, limit: 25 });
      render(<AdminDashboardClient />);
      expect(screen.getByText("2 / 3")).toBeDefined();
    });
  });

  // ─── Tab switching to dynamic panels ──────────────────────────────────

  describe("tab switching", () => {
    it("shows agents panel when activeTab is agents", () => {
      mockState = createMockState({ activeTab: "agents" });
      render(<AdminDashboardClient />);
      const panel = screen.getByRole("tabpanel");
      expect(panel.getAttribute("id")).toBe("tabpanel-agents");
      expect(panel.getAttribute("aria-labelledby")).toBe("tab-agents");
    });

    it("shows engagement panel when activeTab is engagement", () => {
      mockState = createMockState({ activeTab: "engagement" });
      render(<AdminDashboardClient />);
      const panel = screen.getByRole("tabpanel");
      expect(panel.getAttribute("id")).toBe("tabpanel-engagement");
      expect(panel.getAttribute("aria-labelledby")).toBe("tab-engagement");
    });

    it("shows campaigns panel when activeTab is campaigns", () => {
      mockState = createMockState({ activeTab: "campaigns" });
      render(<AdminDashboardClient />);
      const panel = screen.getByRole("tabpanel");
      expect(panel.getAttribute("id")).toBe("tabpanel-campaigns");
      expect(panel.getAttribute("aria-labelledby")).toBe("tab-campaigns");
    });

    it("does not render user table when on agents tab", () => {
      mockState = createMockState({ activeTab: "agents" });
      render(<AdminDashboardClient />);
      expect(screen.queryByTestId("admin-user-table")).toBeNull();
    });

    it("renders dynamic AgentsDashboard component on agents tab", () => {
      mockState = createMockState({ activeTab: "agents" });
      render(<AdminDashboardClient />);
      expect(screen.getByTestId("dynamic-loading-agents")).toBeDefined();
    });

    it("renders dynamic EngagementDashboard component on engagement tab", () => {
      mockState = createMockState({ activeTab: "engagement" });
      render(<AdminDashboardClient />);
      expect(screen.getByTestId("dynamic-loading-engagement")).toBeDefined();
    });

    it("renders dynamic CampaignsDashboard component on campaigns tab", () => {
      mockState = createMockState({ activeTab: "campaigns" });
      render(<AdminDashboardClient />);
      expect(screen.getByTestId("dynamic-loading-campaigns")).toBeDefined();
    });
  });

  // ─── Additional branch coverage ─────────────────────────────────────

  describe("additional branch coverage", () => {
    it("does not show 'updated' text when lastRefreshed is null", () => {
      mockState = createMockState({ total: 5, lastRefreshed: null });
      render(<AdminDashboardClient />);
      expect(screen.queryByText(/updated/)).toBeNull();
      expect(screen.queryByText(/formatted:/)).toBeNull();
    });

    it("shows 0 developers with plural form", () => {
      mockState = createMockState({ total: 0 });
      render(<AdminDashboardClient />);
      expect(screen.getByText("0 developers", { exact: false })).toBeDefined();
    });

    it("loading with agents tab skips loading state and shows agents panel", () => {
      mockState = createMockState({ loading: true, activeTab: "agents" });
      render(<AdminDashboardClient />);
      expect(screen.queryByTestId("admin-table-skeleton")).toBeNull();
      const panel = screen.getByRole("tabpanel");
      expect(panel.getAttribute("id")).toBe("tabpanel-agents");
    });

    it("loading with engagement tab skips loading state and shows engagement panel", () => {
      mockState = createMockState({ loading: true, activeTab: "engagement" });
      render(<AdminDashboardClient />);
      expect(screen.queryByTestId("admin-table-skeleton")).toBeNull();
      const panel = screen.getByRole("tabpanel");
      expect(panel.getAttribute("id")).toBe("tabpanel-engagement");
    });

    it("loading with campaigns tab skips loading state and shows campaigns panel", () => {
      mockState = createMockState({ loading: true, activeTab: "campaigns" });
      render(<AdminDashboardClient />);
      expect(screen.queryByTestId("admin-table-skeleton")).toBeNull();
      const panel = screen.getByRole("tabpanel");
      expect(panel.getAttribute("id")).toBe("tabpanel-campaigns");
    });

    it("error with engagement tab skips error state and shows engagement panel", () => {
      mockState = createMockState({ error: "fail", activeTab: "engagement" });
      render(<AdminDashboardClient />);
      expect(screen.queryByText("fail")).toBeNull();
      const panel = screen.getByRole("tabpanel");
      expect(panel.getAttribute("id")).toBe("tabpanel-engagement");
    });

    it("error with campaigns tab skips error state and shows campaigns panel", () => {
      mockState = createMockState({ error: "fail", activeTab: "campaigns" });
      render(<AdminDashboardClient />);
      expect(screen.queryByText("fail")).toBeNull();
      const panel = screen.getByRole("tabpanel");
      expect(panel.getAttribute("id")).toBe("tabpanel-campaigns");
    });

    it("refresh icon has animate-spin class when refreshing", () => {
      mockState = createMockState({ refreshing: true });
      render(<AdminDashboardClient />);
      const button = screen.getByLabelText("Refresh data");
      const svg = button.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg!.className.baseVal || svg!.getAttribute("class")).toContain("animate-spin");
    });

    it("refresh icon does not have animate-spin class when not refreshing", () => {
      mockState = createMockState({ refreshing: false });
      render(<AdminDashboardClient />);
      const button = screen.getByLabelText("Refresh data");
      const svg = button.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg!.className.baseVal || svg!.getAttribute("class")).not.toContain("animate-spin");
    });

    it("shows pagination range text 'Showing X-Y of Z'", () => {
      mockState = createMockState({ totalPages: 3, page: 2, total: 75, limit: 25 });
      render(<AdminDashboardClient />);
      // Page 2 with limit 25: showing 26–50 of 75
      expect(screen.getByText(/Showing 26/)).toBeDefined();
      expect(screen.getByText(/of 75/)).toBeDefined();
    });

    it("shows correct range on last page when total is not a multiple of limit", () => {
      mockState = createMockState({ totalPages: 3, page: 3, total: 65, limit: 25 });
      render(<AdminDashboardClient />);
      // Page 3 with limit 25: showing 51–65 of 65
      expect(screen.getByText(/Showing 51/)).toBeDefined();
      expect(screen.getByText(/of 65/)).toBeDefined();
    });

    it("active tab button has amber border class", () => {
      mockState = createMockState({ activeTab: "users" });
      render(<AdminDashboardClient />);
      const usersTab = screen.getByRole("tab", { name: "Users" });
      expect(usersTab.className).toContain("border-amber");
      expect(usersTab.className).toContain("text-amber");
    });

    it("inactive tab button has transparent border class", () => {
      mockState = createMockState({ activeTab: "users" });
      render(<AdminDashboardClient />);
      const agentsTab = screen.getByRole("tab", { name: "Agents" });
      expect(agentsTab.className).toContain("border-transparent");
      expect(agentsTab.className).toContain("text-text-secondary");
    });

    it("calls setActiveTab('engagement') when Engagement tab is clicked", () => {
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByRole("tab", { name: "Engagement" }));
      expect(mockState.setActiveTab).toHaveBeenCalledWith("engagement");
    });

    it("calls setActiveTab('campaigns') when Campaigns tab is clicked", () => {
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByRole("tab", { name: "Campaigns" }));
      expect(mockState.setActiveTab).toHaveBeenCalledWith("campaigns");
    });

    it("calls setActiveTab('users') when Users tab is clicked", () => {
      mockState = createMockState({ activeTab: "agents" });
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByRole("tab", { name: "Users" }));
      expect(mockState.setActiveTab).toHaveBeenCalledWith("users");
    });

    it("refresh button is not disabled when not refreshing", () => {
      mockState = createMockState({ refreshing: false });
      render(<AdminDashboardClient />);
      const button = screen.getByLabelText("Refresh data");
      expect(button.hasAttribute("disabled")).toBe(false);
    });
  });
});
