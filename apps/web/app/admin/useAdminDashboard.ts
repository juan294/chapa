"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { AdminUser, SortField, SortDir, PaginatedResponse } from "./admin-types";

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

export type AdminTab = "users" | "agents" | "engagement" | "campaigns";

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface AdminDashboardState {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  users: AdminUser[];
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  deferredSearch: string;
  sortField: SortField;
  sortDir: SortDir;
  refreshing: boolean;
  lastRefreshed: Date | null;
  fetchUsers: (isRefresh?: boolean) => Promise<void>;
  handleSort: (field: SortField) => void;
  tierCounts: Record<string, number>;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  page: number;
  setPage: (page: number) => void;
  total: number;
  totalPages: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// useAdminDashboard — state management for admin dashboard
// ---------------------------------------------------------------------------

export function useAdminDashboard(): AdminDashboardState {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearchRaw] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortField, setSortField] = useState<SortField>("adjustedComposite");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 25;

  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: sortField,
        dir: sortDir,
      });
      if (deferredSearch.trim()) {
        params.set("search", deferredSearch.trim());
      }

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data: PaginatedResponse = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, sortField, sortDir, deferredSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Listen for /refresh command from GlobalCommandBar
  useEffect(() => {
    const handler = () => fetchUsers(true);
    window.addEventListener("chapa:admin-refresh", handler);
    return () => window.removeEventListener("chapa:admin-refresh", handler);
  }, [fetchUsers]);

  // Listen for tab-switching events from command bar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const tab = detail?.tab as AdminTab | undefined;
      if (tab === "users" || tab === "agents" || tab === "engagement" || tab === "campaigns") setActiveTab(tab);
    };
    window.addEventListener("chapa:admin-tab", handler);
    return () => window.removeEventListener("chapa:admin-tab", handler);
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
      setPage(1);
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

  // Search resets to page 1
  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPage(1);
  }, []);

  // Summary stats — computed from current page users
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { Elite: 0, High: 0, Solid: 0, Emerging: 0 };
    for (const u of users) {
      if (u.tier) counts[u.tier] = (counts[u.tier] ?? 0) + 1;
    }
    return counts;
  }, [users]);

  return {
    activeTab,
    setActiveTab,
    users,
    loading,
    error,
    search,
    setSearch,
    deferredSearch,
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
  };
}
