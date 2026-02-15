"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminUser {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  fetchedAt: string | null;
  commitsTotal: number | null;
  prsMergedCount: number | null;
  reviewsSubmittedCount: number | null;
  activeDays: number | null;
  reposContributed: number | null;
  totalStars: number | null;
  archetype: string | null;
  tier: string | null;
  adjustedComposite: number | null;
  confidence: number | null;
  statsExpired: boolean;
}

type SortField =
  | "handle"
  | "archetype"
  | "tier"
  | "adjustedComposite"
  | "confidence"
  | "commitsTotal"
  | "prsMergedCount"
  | "reviewsSubmittedCount"
  | "activeDays"
  | "totalStars"
  | "fetchedAt";

type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER_ORDER: Record<string, number> = {
  Elite: 4,
  High: 3,
  Solid: 2,
  Emerging: 1,
};

const ARCHETYPE_COLOR: Record<string, string> = {
  Builder: "text-archetype-builder",
  Guardian: "text-archetype-guardian",
  Marathoner: "text-archetype-marathoner",
  Polymath: "text-archetype-polymath",
  Balanced: "text-archetype-balanced",
  Emerging: "text-archetype-emerging",
};

const TIER_COLOR: Record<string, string> = {
  Elite: "text-amber",
  High: "text-terminal-green",
  Solid: "text-text-primary",
  Emerging: "text-text-secondary",
};

function tierBadgeClasses(tier: string): string {
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium font-heading";
  switch (tier) {
    case "Elite":
      return `${base} bg-amber/10 text-amber`;
    case "High":
      return `${base} bg-terminal-green/10 text-terminal-green`;
    case "Solid":
      return `${base} bg-text-primary/10 text-text-primary`;
    default:
      return `${base} bg-text-secondary/10 text-text-secondary`;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) return "< 1h ago";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sortUsers(
  users: AdminUser[],
  field: SortField,
  dir: SortDir,
): AdminUser[] {
  return [...users].sort((a, b) => {
    // Expired users always sort to the bottom
    if (a.statsExpired !== b.statsExpired) return a.statsExpired ? 1 : -1;

    let cmp = 0;
    if (field === "handle") {
      cmp = a.handle.localeCompare(b.handle);
    } else if (field === "tier") {
      cmp = (TIER_ORDER[a.tier ?? ""] ?? 0) - (TIER_ORDER[b.tier ?? ""] ?? 0);
    } else if (field === "archetype") {
      cmp = (a.archetype ?? "").localeCompare(b.archetype ?? "");
    } else if (field === "fetchedAt") {
      cmp = new Date(a.fetchedAt ?? 0).getTime() - new Date(b.fetchedAt ?? 0).getTime();
    } else {
      cmp = ((a[field] as number) ?? 0) - ((b[field] as number) ?? 0);
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg className="ml-1 inline h-3 w-3 text-text-secondary/40" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M6 2v8M3 5l3-3 3 3" />
      </svg>
    );
  }
  return (
    <svg className="ml-1 inline h-3 w-3 text-amber" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      {dir === "asc" ? <path d="M6 2v8M3 5l3-3 3 3" /> : <path d="M6 10V2M3 7l3 3 3-3" />}
    </svg>
  );
}

function StatCard({
  label,
  value,
  detail,
  delay,
}: {
  label: string;
  value: string | number;
  detail?: string;
  delay: number;
}) {
  return (
    <div
      className="rounded-xl border border-stroke bg-card p-4 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="font-heading text-xs text-text-secondary tracking-wider uppercase">
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl text-text-primary tabular-nums">
        {value}
      </p>
      {detail && (
        <p className="mt-0.5 text-xs text-text-secondary">{detail}</p>
      )}
    </div>
  );
}

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
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
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

  const handleImgError = useCallback((handle: string) => {
    setImgErrors((prev) => new Set(prev).add(handle));
  }, []);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
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

  const thClasses =
    "px-3 py-2.5 text-left font-heading text-xs font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap";

  const thBtnClasses =
    "inline-flex items-center bg-transparent border-none p-0 font-heading text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer select-none hover:text-text-primary transition-colors whitespace-nowrap";

  function ariaSortValue(field: SortField): "ascending" | "descending" | "none" {
    if (sortField !== field) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

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
          title="Refresh data"
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Users" value={users.length} delay={0} />
        <StatCard
          label="Elite"
          value={tierCounts.Elite ?? 0}
          detail={users.length > 0 ? `${((tierCounts.Elite ?? 0) / users.length * 100).toFixed(0)}%` : undefined}
          delay={50}
        />
        <StatCard
          label="High"
          value={tierCounts.High ?? 0}
          detail={users.length > 0 ? `${((tierCounts.High ?? 0) / users.length * 100).toFixed(0)}%` : undefined}
          delay={100}
        />
        <StatCard
          label="Solid"
          value={tierCounts.Solid ?? 0}
          detail={users.length > 0 ? `${((tierCounts.Solid ?? 0) / users.length * 100).toFixed(0)}%` : undefined}
          delay={150}
        />
        <StatCard
          label="Emerging"
          value={tierCounts.Emerging ?? 0}
          detail={users.length > 0 ? `${((tierCounts.Emerging ?? 0) / users.length * 100).toFixed(0)}%` : undefined}
          delay={200}
        />
      </div>

      {/* Search + Table */}
      <div
        className="rounded-xl border border-stroke bg-card overflow-hidden animate-fade-in-up"
        style={{ animationDelay: "250ms" }}
      >
        {/* Search bar */}
        <div className="border-b border-stroke px-4 py-3 flex items-center gap-3">
          <span className="font-heading text-sm text-amber" aria-hidden="true">
            &gt;
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="filter by handle or name..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/50 font-heading outline-none"
            aria-label="Filter users"
          />
          {search && (
            <span className="text-xs text-text-secondary tabular-nums">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke">
                <th scope="col" className={thClasses} aria-sort={ariaSortValue("handle")}>
                  <button type="button" className={thBtnClasses} onClick={() => handleSort("handle")}>
                    Developer
                    <SortIcon active={sortField === "handle"} dir={sortDir} />
                  </button>
                </th>
                <th scope="col" className={`${thClasses} hidden sm:table-cell`} aria-sort={ariaSortValue("archetype")}>
                  <button type="button" className={thBtnClasses} onClick={() => handleSort("archetype")}>
                    Archetype
                    <SortIcon active={sortField === "archetype"} dir={sortDir} />
                  </button>
                </th>
                <th scope="col" className={thClasses} aria-sort={ariaSortValue("tier")}>
                  <button type="button" className={thBtnClasses} onClick={() => handleSort("tier")}>
                    Tier
                    <SortIcon active={sortField === "tier"} dir={sortDir} />
                  </button>
                </th>
                <th scope="col" className={thClasses} aria-sort={ariaSortValue("adjustedComposite")}>
                  <button type="button" className={thBtnClasses} onClick={() => handleSort("adjustedComposite")}>
                    Score
                    <SortIcon active={sortField === "adjustedComposite"} dir={sortDir} />
                  </button>
                </th>
                <th scope="col" className={`${thClasses} hidden md:table-cell`} aria-sort={ariaSortValue("confidence")}>
                  <button type="button" className={thBtnClasses} onClick={() => handleSort("confidence")}>
                    Conf
                    <SortIcon active={sortField === "confidence"} dir={sortDir} />
                  </button>
                </th>
                <th scope="col" className={`${thClasses} hidden lg:table-cell`} aria-sort={ariaSortValue("commitsTotal")}>
                  <button type="button" className={thBtnClasses} onClick={() => handleSort("commitsTotal")}>
                    Commits
                    <SortIcon active={sortField === "commitsTotal"} dir={sortDir} />
                  </button>
                </th>
                <th scope="col" className={`${thClasses} hidden lg:table-cell`} aria-sort={ariaSortValue("prsMergedCount")}>
                  <button type="button" className={thBtnClasses} onClick={() => handleSort("prsMergedCount")}>
                    PRs
                    <SortIcon active={sortField === "prsMergedCount"} dir={sortDir} />
                  </button>
                </th>
                <th scope="col" className={`${thClasses} hidden xl:table-cell`} aria-sort={ariaSortValue("reviewsSubmittedCount")}>
                  <button type="button" className={thBtnClasses} onClick={() => handleSort("reviewsSubmittedCount")}>
                    Reviews
                    <SortIcon active={sortField === "reviewsSubmittedCount"} dir={sortDir} />
                  </button>
                </th>
                <th scope="col" className={`${thClasses} hidden xl:table-cell`} aria-sort={ariaSortValue("activeDays")}>
                  <button type="button" className={thBtnClasses} onClick={() => handleSort("activeDays")}>
                    Days
                    <SortIcon active={sortField === "activeDays"} dir={sortDir} />
                  </button>
                </th>
                <th scope="col" className={`${thClasses} hidden xl:table-cell`} aria-sort={ariaSortValue("totalStars")}>
                  <button type="button" className={thBtnClasses} onClick={() => handleSort("totalStars")}>
                    Stars
                    <SortIcon active={sortField === "totalStars"} dir={sortDir} />
                  </button>
                </th>
                <th scope="col" className={`${thClasses} hidden md:table-cell`} aria-sort={ariaSortValue("fetchedAt")}>
                  <button type="button" className={thBtnClasses} onClick={() => handleSort("fetchedAt")}>
                    Updated
                    <SortIcon active={sortField === "fetchedAt"} dir={sortDir} />
                  </button>
                </th>
                <th scope="col" className={`${thClasses} w-10`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-3 py-12 text-center text-sm text-text-secondary"
                  >
                    {search ? "No users match your search." : "No users found."}
                  </td>
                </tr>
              ) : (
                sorted.map((user) => (
                  <tr
                    key={user.handle}
                    className={`transition-colors hover:bg-amber/[0.03] ${user.statsExpired ? "opacity-60" : ""}`}
                  >
                    {/* Developer */}
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/u/${user.handle}`}
                        className="flex items-center gap-2.5 group"
                      >
                        {user.avatarUrl && !imgErrors.has(user.handle) ? (
                          <Image
                            src={user.avatarUrl}
                            alt=""
                            width={28}
                            height={28}
                            className="h-7 w-7 rounded-full"
                            onError={() => handleImgError(user.handle)}
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber/10 text-xs font-semibold text-amber">
                            {user.handle.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-heading text-sm text-text-primary group-hover:text-amber transition-colors">
                            {user.handle}
                          </p>
                          {user.statsExpired ? (
                            <p className="text-xs text-terminal-yellow">data expired</p>
                          ) : user.displayName ? (
                            <p className="truncate text-xs text-text-secondary">
                              {user.displayName}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </td>

                    {/* Archetype */}
                    <td className="hidden sm:table-cell px-3 py-2.5">
                      {user.archetype ? (
                        <span className={`font-heading text-xs font-medium ${ARCHETYPE_COLOR[user.archetype] ?? "text-text-secondary"}`}>
                          {user.archetype}
                        </span>
                      ) : (
                        <span className="text-xs text-text-secondary/50">&mdash;</span>
                      )}
                    </td>

                    {/* Tier */}
                    <td className="px-3 py-2.5">
                      {user.tier ? (
                        <span className={tierBadgeClasses(user.tier)}>
                          {user.tier}
                        </span>
                      ) : (
                        <span className="text-xs text-text-secondary/50">&mdash;</span>
                      )}
                    </td>

                    {/* Score */}
                    <td className="px-3 py-2.5">
                      {user.adjustedComposite != null ? (
                        <span className={`font-heading text-sm tabular-nums ${TIER_COLOR[user.tier ?? ""] ?? "text-text-secondary"}`}>
                          {user.adjustedComposite}
                        </span>
                      ) : (
                        <span className="text-xs text-text-secondary/50">&mdash;</span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="hidden md:table-cell px-3 py-2.5">
                      {user.confidence != null ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-1 w-10 rounded-full bg-stroke overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber/60"
                              style={{ width: `${user.confidence}%` }}
                            />
                          </div>
                          <span className="font-heading text-xs text-text-secondary tabular-nums">
                            {user.confidence}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-secondary/50">&mdash;</span>
                      )}
                    </td>

                    {/* Stats columns */}
                    <td className="hidden lg:table-cell px-3 py-2.5 font-heading text-xs text-text-secondary tabular-nums">
                      {user.commitsTotal != null ? user.commitsTotal.toLocaleString() : "\u2014"}
                    </td>
                    <td className="hidden lg:table-cell px-3 py-2.5 font-heading text-xs text-text-secondary tabular-nums">
                      {user.prsMergedCount ?? "\u2014"}
                    </td>
                    <td className="hidden xl:table-cell px-3 py-2.5 font-heading text-xs text-text-secondary tabular-nums">
                      {user.reviewsSubmittedCount ?? "\u2014"}
                    </td>
                    <td className="hidden xl:table-cell px-3 py-2.5 font-heading text-xs text-text-secondary tabular-nums">
                      {user.activeDays ?? "\u2014"}
                    </td>
                    <td className="hidden xl:table-cell px-3 py-2.5 font-heading text-xs text-text-secondary tabular-nums">
                      {user.totalStars != null ? user.totalStars.toLocaleString() : "\u2014"}
                    </td>

                    {/* Updated */}
                    <td className="hidden md:table-cell px-3 py-2.5 text-xs text-text-secondary">
                      {user.fetchedAt ? formatDate(user.fetchedAt) : "\u2014"}
                    </td>

                    {/* Badge link */}
                    <td className="px-3 py-2.5">
                      <a
                        href={`/u/${user.handle}/badge.svg`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md p-1 text-text-secondary hover:text-amber hover:bg-amber/[0.06] transition-colors"
                        title="View badge SVG"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M9 3v18M3 9h18" />
                        </svg>
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
