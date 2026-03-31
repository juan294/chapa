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
  AdminSearchBar: (props: { search: string; onSearchChange: (v: string) => void; resultCount: number }) => (
    <div data-testid="admin-search-bar" data-search={props.search} data-count={props.resultCount}>
      <input
        data-testid="search-input"
        value={props.search}
        onChange={(e) => props.onSearchChange(e.target.value)}
      />
    </div>
  ),
}));

vi.mock("./AdminStatsCards", () => ({
  AdminStatsCards: (props: { totalUsers: number }) => (
    <div data-testid="admin-stats-cards" data-total={props.totalUsers} />
  ),
}));

vi.mock("./AdminUserTable", () => ({
  AdminUserTable: (props: {
    users: unknown[];
    search: string;
    sortField: string;
    sortDir: string;
    onSort: (field: string) => void;
  }) => (
    <div data-testid="admin-user-table" data-sort-field={props.sortField} data-sort-dir={props.sortDir}>
      <button data-testid="sort-btn" onClick={() => props.onSort("handle")}>
        Sort
      </button>
    </div>
  ),
}));

vi.mock("./AdminTableSkeleton", () => ({
  AdminTableSkeleton: () => <div data-testid="admin-table-skeleton" />,
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType }>, opts?: { loading?: () => React.ReactNode }) => {
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

describe("AdminDashboardClient — interaction tests", () => {
  // ─── Tab switching renders correct content ────────────────────────────

  describe("tab switching renders correct content", () => {
    it("clicking Users tab calls setActiveTab('users')", () => {
      mockState = createMockState({ activeTab: "agents" });
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByRole("tab", { name: "Users" }));
      expect(mockState.setActiveTab).toHaveBeenCalledWith("users");
    });

    it("clicking Agents tab calls setActiveTab('agents')", () => {
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByRole("tab", { name: "Agents" }));
      expect(mockState.setActiveTab).toHaveBeenCalledWith("agents");
    });

    it("clicking Engagement tab calls setActiveTab('engagement')", () => {
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByRole("tab", { name: "Engagement" }));
      expect(mockState.setActiveTab).toHaveBeenCalledWith("engagement");
    });

    it("clicking Campaigns tab calls setActiveTab('campaigns')", () => {
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByRole("tab", { name: "Campaigns" }));
      expect(mockState.setActiveTab).toHaveBeenCalledWith("campaigns");
    });

    it("agents tab renders AgentsDashboard dynamic component", () => {
      mockState = createMockState({ activeTab: "agents" });
      render(<AdminDashboardClient />);
      expect(screen.getByTestId("dynamic-loading-agents")).toBeDefined();
      expect(screen.queryByTestId("admin-user-table")).toBeNull();
      expect(screen.queryByTestId("admin-search-bar")).toBeNull();
    });

    it("engagement tab renders EngagementDashboard dynamic component", () => {
      mockState = createMockState({ activeTab: "engagement" });
      render(<AdminDashboardClient />);
      expect(screen.getByTestId("dynamic-loading-engagement")).toBeDefined();
      expect(screen.queryByTestId("admin-user-table")).toBeNull();
    });

    it("campaigns tab renders CampaignsDashboard dynamic component", () => {
      mockState = createMockState({ activeTab: "campaigns" });
      render(<AdminDashboardClient />);
      expect(screen.getByTestId("dynamic-loading-campaigns")).toBeDefined();
      expect(screen.queryByTestId("admin-user-table")).toBeNull();
    });

    it("users tab renders user table and search bar", () => {
      mockState = createMockState({ activeTab: "users" });
      render(<AdminDashboardClient />);
      expect(screen.getByTestId("admin-user-table")).toBeDefined();
      expect(screen.getByTestId("admin-search-bar")).toBeDefined();
      expect(screen.queryByTestId("dynamic-loading-agents")).toBeNull();
    });
  });

  // ─── Search handler ────────────────────────────────────────────────────

  describe("search handler", () => {
    it("typing in search field calls setSearch with the new value", () => {
      mockState = createMockState({ activeTab: "users", total: 5 });
      render(<AdminDashboardClient />);
      const input = screen.getByTestId("search-input");
      fireEvent.change(input, { target: { value: "john" } });
      expect(mockState.setSearch).toHaveBeenCalledWith("john");
    });

    it("passes current search value to AdminSearchBar", () => {
      mockState = createMockState({ activeTab: "users", search: "alice", total: 3 });
      render(<AdminDashboardClient />);
      const searchBar = screen.getByTestId("admin-search-bar");
      expect(searchBar.getAttribute("data-search")).toBe("alice");
    });

    it("passes result count to AdminSearchBar", () => {
      mockState = createMockState({ activeTab: "users", total: 42 });
      render(<AdminDashboardClient />);
      const searchBar = screen.getByTestId("admin-search-bar");
      expect(searchBar.getAttribute("data-count")).toBe("42");
    });
  });

  // ─── Sort handler ─────────────────────────────────────────────────────

  describe("sort handler", () => {
    it("clicking sort button in table calls handleSort with the field", () => {
      mockState = createMockState({ activeTab: "users", total: 5 });
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByTestId("sort-btn"));
      expect(mockState.handleSort).toHaveBeenCalledWith("handle");
    });

    it("passes current sortField and sortDir to AdminUserTable", () => {
      mockState = createMockState({
        activeTab: "users",
        sortField: "handle",
        sortDir: "asc",
        total: 5,
      });
      render(<AdminDashboardClient />);
      const table = screen.getByTestId("admin-user-table");
      expect(table.getAttribute("data-sort-field")).toBe("handle");
      expect(table.getAttribute("data-sort-dir")).toBe("asc");
    });
  });

  // ─── Pagination interactions ──────────────────────────────────────────

  describe("pagination interactions", () => {
    it("clicking Previous decrements page", () => {
      mockState = createMockState({ totalPages: 5, page: 3, total: 125, limit: 25 });
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByLabelText("Previous page"));
      expect(mockState.setPage).toHaveBeenCalledWith(2);
    });

    it("clicking Next increments page", () => {
      mockState = createMockState({ totalPages: 5, page: 3, total: 125, limit: 25 });
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByLabelText("Next page"));
      expect(mockState.setPage).toHaveBeenCalledWith(4);
    });

    it("Previous button is disabled on page 1", () => {
      mockState = createMockState({ totalPages: 5, page: 1, total: 125, limit: 25 });
      render(<AdminDashboardClient />);
      expect(screen.getByLabelText("Previous page").hasAttribute("disabled")).toBe(true);
    });

    it("Next button is disabled on last page", () => {
      mockState = createMockState({ totalPages: 5, page: 5, total: 125, limit: 25 });
      render(<AdminDashboardClient />);
      expect(screen.getByLabelText("Next page").hasAttribute("disabled")).toBe(true);
    });

    it("both buttons enabled on middle page", () => {
      mockState = createMockState({ totalPages: 5, page: 3, total: 125, limit: 25 });
      render(<AdminDashboardClient />);
      expect(screen.getByLabelText("Previous page").hasAttribute("disabled")).toBe(false);
      expect(screen.getByLabelText("Next page").hasAttribute("disabled")).toBe(false);
    });

    it("displays correct page range on first page", () => {
      mockState = createMockState({ totalPages: 3, page: 1, total: 75, limit: 25 });
      render(<AdminDashboardClient />);
      expect(screen.getByText(/Showing 1/)).toBeDefined();
      expect(screen.getByText(/of 75/)).toBeDefined();
    });

    it("does not render pagination controls for single-page results", () => {
      mockState = createMockState({ totalPages: 1, page: 1, total: 10, limit: 25 });
      render(<AdminDashboardClient />);
      expect(screen.queryByLabelText("Previous page")).toBeNull();
      expect(screen.queryByLabelText("Next page")).toBeNull();
    });

    it("shows correct page indicator text", () => {
      mockState = createMockState({ totalPages: 4, page: 2, total: 100, limit: 25 });
      render(<AdminDashboardClient />);
      expect(screen.getByText("2 / 4")).toBeDefined();
    });
  });

  // ─── Error state retry ────────────────────────────────────────────────

  describe("error state", () => {
    it("shows error message and retry button", () => {
      mockState = createMockState({ error: "Network timeout", activeTab: "users" });
      render(<AdminDashboardClient />);
      expect(screen.getByText("Network timeout")).toBeDefined();
      expect(screen.getByText("Retry")).toBeDefined();
    });

    it("retry button calls setError(null), setLoading(true), and fetchUsers()", () => {
      mockState = createMockState({ error: "Connection failed", activeTab: "users" });
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByText("Retry"));
      expect(mockState.setError).toHaveBeenCalledWith(null);
      expect(mockState.setLoading).toHaveBeenCalledWith(true);
      expect(mockState.fetchUsers).toHaveBeenCalled();
    });

    it("error state only shows on users tab", () => {
      mockState = createMockState({ error: "API error", activeTab: "agents" });
      render(<AdminDashboardClient />);
      expect(screen.queryByText("API error")).toBeNull();
      expect(screen.queryByText("Retry")).toBeNull();
    });

    it("error state still renders tab bar for navigation", () => {
      mockState = createMockState({ error: "Server error", activeTab: "users" });
      render(<AdminDashboardClient />);
      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(4);
    });
  });

  // ─── Loading state per tab ────────────────────────────────────────────

  describe("loading states per tab", () => {
    it("shows skeleton loader only when loading on users tab", () => {
      mockState = createMockState({ loading: true, activeTab: "users" });
      render(<AdminDashboardClient />);
      expect(screen.getByTestId("admin-table-skeleton")).toBeDefined();
    });

    it("does not show skeleton when loading on agents tab", () => {
      mockState = createMockState({ loading: true, activeTab: "agents" });
      render(<AdminDashboardClient />);
      expect(screen.queryByTestId("admin-table-skeleton")).toBeNull();
      expect(screen.getByTestId("dynamic-loading-agents")).toBeDefined();
    });

    it("does not show skeleton when loading on engagement tab", () => {
      mockState = createMockState({ loading: true, activeTab: "engagement" });
      render(<AdminDashboardClient />);
      expect(screen.queryByTestId("admin-table-skeleton")).toBeNull();
      expect(screen.getByTestId("dynamic-loading-engagement")).toBeDefined();
    });

    it("does not show skeleton when loading on campaigns tab", () => {
      mockState = createMockState({ loading: true, activeTab: "campaigns" });
      render(<AdminDashboardClient />);
      expect(screen.queryByTestId("admin-table-skeleton")).toBeNull();
      expect(screen.getByTestId("dynamic-loading-campaigns")).toBeDefined();
    });

    it("loading skeleton has sr-only announcement", () => {
      mockState = createMockState({ loading: true, activeTab: "users" });
      render(<AdminDashboardClient />);
      const announcement = screen.getByText("Loading user data");
      expect(announcement.classList.contains("sr-only")).toBe(true);
    });

    it("loading state still shows tab bar for switching", () => {
      mockState = createMockState({ loading: true, activeTab: "users" });
      render(<AdminDashboardClient />);
      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(4);
      // Can still click another tab during loading
      fireEvent.click(screen.getByRole("tab", { name: "Agents" }));
      expect(mockState.setActiveTab).toHaveBeenCalledWith("agents");
    });
  });

  // ─── Refresh button interactions ──────────────────────────────────────

  describe("refresh button interactions", () => {
    it("calls fetchUsers(true) for a forced refresh", () => {
      mockState = createMockState({ total: 10 });
      render(<AdminDashboardClient />);
      fireEvent.click(screen.getByLabelText("Refresh data"));
      expect(mockState.fetchUsers).toHaveBeenCalledWith(true);
    });

    it("disabled while refreshing", () => {
      mockState = createMockState({ refreshing: true, total: 10 });
      render(<AdminDashboardClient />);
      expect(screen.getByLabelText("Refresh data").hasAttribute("disabled")).toBe(true);
      expect(screen.getByText("Refreshing...")).toBeDefined();
    });

    it("enabled when not refreshing", () => {
      mockState = createMockState({ refreshing: false, total: 10 });
      render(<AdminDashboardClient />);
      expect(screen.getByLabelText("Refresh data").hasAttribute("disabled")).toBe(false);
      expect(screen.getByText("Refresh")).toBeDefined();
    });

    it("shows animated spinner icon while refreshing", () => {
      mockState = createMockState({ refreshing: true, total: 10 });
      render(<AdminDashboardClient />);
      const svg = screen.getByLabelText("Refresh data").querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg!.className.baseVal || svg!.getAttribute("class")).toContain("animate-spin");
    });
  });

  // ─── Tab aria attributes ──────────────────────────────────────────────

  describe("tab aria attributes", () => {
    it("each tab has correct aria-controls", () => {
      render(<AdminDashboardClient />);
      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]!.getAttribute("aria-controls")).toBe("tabpanel-users");
      expect(tabs[1]!.getAttribute("aria-controls")).toBe("tabpanel-agents");
      expect(tabs[2]!.getAttribute("aria-controls")).toBe("tabpanel-engagement");
      expect(tabs[3]!.getAttribute("aria-controls")).toBe("tabpanel-campaigns");
    });

    it("only the active tab has aria-selected=true", () => {
      mockState = createMockState({ activeTab: "engagement" });
      render(<AdminDashboardClient />);
      const tabs = screen.getAllByRole("tab");
      expect(tabs[0]!.getAttribute("aria-selected")).toBe("false");
      expect(tabs[1]!.getAttribute("aria-selected")).toBe("false");
      expect(tabs[2]!.getAttribute("aria-selected")).toBe("true");
      expect(tabs[3]!.getAttribute("aria-selected")).toBe("false");
    });
  });
});
