"use client";

import { formatDate } from "./admin-types";
import { AdminSearchBar } from "./AdminSearchBar";
import { AdminStatsCards } from "./AdminStatsCards";
import { AdminUserTable } from "./AdminUserTable";
import { AdminTableSkeleton } from "./AdminTableSkeleton";
import { useAdminDashboard } from "./useAdminDashboard";
import type { AdminTab } from "./useAdminDashboard";
import dynamic from "next/dynamic";

const AgentsDashboard = dynamic(
  () => import("./agents/agents-dashboard").then((m) => ({ default: m.AgentsDashboard })),
  { ssr: false, loading: () => <div className="animate-pulse p-8">Loading agents...</div> },
);
const EngagementDashboard = dynamic(
  () => import("./engagement/engagement-dashboard").then((m) => ({ default: m.EngagementDashboard })),
  { ssr: false, loading: () => <div className="animate-pulse p-8">Loading engagement...</div> },
);
const CampaignsDashboard = dynamic(
  () => import("./campaigns/campaigns-dashboard").then((m) => ({ default: m.CampaignsDashboard })),
  { ssr: false, loading: () => <div className="animate-pulse p-8">Loading campaigns...</div> },
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminDashboardClient() {
  const {
    activeTab,
    setActiveTab,
    users,
    loading,
    error,
    search,
    setSearch,
    sortField,
    sortDir,
    refreshing,
    lastRefreshed,
    fetchUsers,
    handleSort,
    tierCounts,
    setError,
    setLoading,
    page,
    setPage,
    total,
    totalPages,
    limit,
  } = useAdminDashboard();

  // -------------------------------------------------------------------------
  // Tab navigation
  // -------------------------------------------------------------------------

  const tabClasses = (tab: AdminTab) =>
    `px-4 py-2 font-heading text-sm transition-colors ${
      activeTab === tab
        ? "border-b-2 border-amber text-amber"
        : "border-b-2 border-transparent text-text-secondary hover:text-text-primary"
    }`;

  const tabBar = (
    <div role="tablist" aria-label="Admin sections" className="flex gap-0 border-b border-stroke">
      <button
        id="tab-users"
        role="tab"
        aria-selected={activeTab === "users"}
        aria-controls="tabpanel-users"
        className={tabClasses("users")}
        onClick={() => setActiveTab("users")}
      >
        Users
      </button>
      <button
        id="tab-agents"
        role="tab"
        aria-selected={activeTab === "agents"}
        aria-controls="tabpanel-agents"
        className={tabClasses("agents")}
        onClick={() => setActiveTab("agents")}
      >
        Agents
      </button>
      <button
        id="tab-engagement"
        role="tab"
        aria-selected={activeTab === "engagement"}
        aria-controls="tabpanel-engagement"
        className={tabClasses("engagement")}
        onClick={() => setActiveTab("engagement")}
      >
        Engagement
      </button>
      <button
        id="tab-campaigns"
        role="tab"
        aria-selected={activeTab === "campaigns"}
        aria-controls="tabpanel-campaigns"
        className={tabClasses("campaigns")}
        onClick={() => setActiveTab("campaigns")}
      >
        Campaigns
      </button>
    </div>
  );

  // -------------------------------------------------------------------------
  // Loading state (users tab only — agents tab has its own)
  // -------------------------------------------------------------------------

  if (loading && activeTab === "users") {
    return (
      <div className="space-y-6">
        {tabBar}
        <div role="tabpanel" id="tabpanel-users" aria-labelledby="tab-users" className="space-y-6">
          <h2 className="font-heading text-2xl tracking-tight text-text-primary">
            <span className="text-amber">$</span> admin<span className="text-text-secondary">/</span>users
          </h2>
          <span className="sr-only" aria-live="polite">Loading user data</span>
          <AdminTableSkeleton />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state (users tab only)
  // -------------------------------------------------------------------------

  if (error && activeTab === "users") {
    return (
      <div className="space-y-6">
        {tabBar}
        <div role="tabpanel" id="tabpanel-users" aria-labelledby="tab-users" className="mx-auto max-w-lg py-32 text-center">
          <h2 className="font-heading text-2xl tracking-tight text-text-primary mb-6">
            <span className="text-amber">$</span> admin<span className="text-text-secondary">/</span>users
          </h2>
          <div className="rounded-xl border border-terminal-red/20 bg-terminal-red/5 p-6">
            <p className="font-heading text-sm text-terminal-red">
              <span className="text-terminal-red/50">ERR</span> {error}
            </p>
            <button
              onClick={() => { setError(null); setLoading(true); fetchUsers(); }}
              className="mt-4 rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-white hover:bg-amber-light"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      {tabBar}

      {/* Tab content */}
      {activeTab === "agents" ? (
        <div role="tabpanel" id="tabpanel-agents" aria-labelledby="tab-agents">
          <AgentsDashboard />
        </div>
      ) : activeTab === "engagement" ? (
        <div role="tabpanel" id="tabpanel-engagement" aria-labelledby="tab-engagement">
          <EngagementDashboard />
        </div>
      ) : activeTab === "campaigns" ? (
        <div role="tabpanel" id="tabpanel-campaigns" aria-labelledby="tab-campaigns">
          <CampaignsDashboard />
        </div>
      ) : (
        <div role="tabpanel" id="tabpanel-users" aria-labelledby="tab-users" className="space-y-6">
          {/* Header */}
          <div className="animate-fade-in-up flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl tracking-tight text-text-primary">
                <span className="text-amber">$</span> admin<span className="text-text-secondary">/</span>users
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {total} developer{total !== 1 ? "s" : ""}
                {lastRefreshed && (
                  <span className="ml-2 text-text-secondary/60">
                    &middot; updated {formatDate(lastRefreshed.toISOString())}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => fetchUsers(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-stroke px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-amber/20 hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh data"
            >
              <svg
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* Summary cards */}
          <AdminStatsCards
            totalUsers={total}
            pageUsers={users.length}
            tierCounts={tierCounts}
          />

          {/* Search + Table */}
          <div
            className="rounded-xl border border-stroke bg-card overflow-hidden animate-fade-in-up"
            style={{ animationDelay: "250ms" }}
          >
            <AdminSearchBar
              search={search}
              onSearchChange={setSearch}
              resultCount={total}
            />
            <AdminUserTable
              users={users}
              search={search}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
            />
            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-stroke px-4 py-3">
                <span className="text-xs text-text-secondary tabular-nums">
                  Showing {((page - 1) * limit) + 1}&ndash;{Math.min(page * limit, total)} of {total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="rounded-md border border-stroke px-3 py-1 text-xs font-medium text-text-secondary hover:border-amber/20 hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-text-secondary tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="rounded-md border border-stroke px-3 py-1 text-xs font-medium text-text-secondary hover:border-amber/20 hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
