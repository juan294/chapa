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
  AdminStatsCards: (props: { totalUsers: number }) => (
    <div data-testid="admin-stats-cards" data-total={props.totalUsers} />
  ),
}));

vi.mock("./AdminUserTable", () => ({
  AdminUserTable: () => <div data-testid="admin-user-table" />,
}));

vi.mock("./AdminTableSkeleton", () => ({
  AdminTableSkeleton: () => <div data-testid="admin-table-skeleton" />,
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType }>, opts?: { loading?: () => React.ReactNode }) => {
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

  // ─── Refresh button ───────────────────────────────────────────────────

  describe("refresh button", () => {
    it("renders refresh button with aria-label", () => {
      render(<AdminDashboardClient />);
      expect(screen.getByLabelText("Refresh data")).toBeDefined();
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
  });
});
