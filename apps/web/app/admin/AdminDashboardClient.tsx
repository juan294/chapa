"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminUser, SortField, SortDir } from "./admin-types";
import { sortUsers, formatDate } from "./admin-types";
import { AdminSearchBar } from "./AdminSearchBar";
import { AdminStatsCards } from "./AdminStatsCards";
import { AdminUserTable } from "./AdminUserTable";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminDashboardClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("adjustedComposite");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setUsers(data.users ?? []);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Listen for /refresh command from GlobalCommandBar
  useEffect(() => {
    const handler = () => fetchUsers(true);
    window.addEventListener("chapa:admin-refresh", handler);
    return () => window.removeEventListener("chapa:admin-refresh", handler);
  }, [fetchUsers]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField],
  );

  // Listen for /sort command from GlobalCommandBar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const field = detail?.field as SortField | undefined;
      const dir = detail?.dir as SortDir | undefined;
      if (!field) return;
      if (dir) {
        setSortField(field);
        setSortDir(dir);
      } else {
        handleSort(field);
      }
    };
    window.addEventListener("chapa:admin-sort", handler);
    return () => window.removeEventListener("chapa:admin-sort", handler);
  }, [handleSort]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.handle.toLowerCase().includes(q) ||
        (u.displayName?.toLowerCase().includes(q) ?? false),
    );
  }, [users, search]);

  const sorted = useMemo(
    () => sortUsers(filtered, sortField, sortDir),
    [filtered, sortField, sortDir],
  );

  // Summary stats
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { Elite: 0, High: 0, Solid: 0, Emerging: 0 };
    for (const u of users) {
      if (u.tier) counts[u.tier] = (counts[u.tier] ?? 0) + 1;
    }
    return counts;
  }, [users]);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <h1 className="font-heading text-2xl tracking-tight text-text-primary">
          <span className="text-amber">$</span> admin<span className="text-text-secondary">/</span>users
        </h1>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stroke border-t-amber" />
        <p className="font-heading text-sm text-text-secondary">
          <span className="text-amber">$</span> fetching user data...
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-32 text-center">
        <h1 className="font-heading text-2xl tracking-tight text-text-primary mb-6">
          <span className="text-amber">$</span> admin<span className="text-text-secondary">/</span>users
        </h1>
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
    );
  }

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl tracking-tight text-text-primary">
            <span className="text-amber">$</span> admin<span className="text-text-secondary">/</span>users
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {users.length} developer{users.length !== 1 ? "s" : ""} with cached badge data
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
      <AdminStatsCards totalUsers={users.length} tierCounts={tierCounts} />

      {/* Search + Table */}
      <div
        className="rounded-xl border border-stroke bg-card overflow-hidden animate-fade-in-up"
        style={{ animationDelay: "250ms" }}
      >
        <AdminSearchBar
          search={search}
          onSearchChange={setSearch}
          resultCount={filtered.length}
        />
        <AdminUserTable
          users={sorted}
          search={search}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>
    </div>
  );
}
