import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { AdminUser, SortField, SortDir } from "./admin-types";
import { ARCHETYPE_COLOR, TIER_COLOR, tierBadgeClasses, formatDate } from "./admin-types";
import { AdminSortableHeader, AdminHeaderCell } from "./AdminSortableHeader";

// ---------------------------------------------------------------------------
// AdminUserTable
// ---------------------------------------------------------------------------

interface AdminUserTableProps {
  users: AdminUser[];
  search: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}

export function AdminUserTable({
  users,
  search,
  sortField,
  sortDir,
  onSort,
}: AdminUserTableProps) {
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const handleImgError = useCallback((handle: string) => {
    setImgErrors((prev) => new Set(prev).add(handle));
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stroke">
            <AdminSortableHeader field="handle" label="Developer" sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <AdminSortableHeader field="archetype" label="Archetype" sortField={sortField} sortDir={sortDir} onSort={onSort} className="hidden sm:table-cell" />
            <AdminSortableHeader field="tier" label="Tier" sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <AdminSortableHeader field="adjustedComposite" label="Score" sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <AdminSortableHeader field="confidence" label="Conf" sortField={sortField} sortDir={sortDir} onSort={onSort} className="hidden md:table-cell" />
            <AdminSortableHeader field="commitsTotal" label="Commits" sortField={sortField} sortDir={sortDir} onSort={onSort} className="hidden lg:table-cell" />
            <AdminSortableHeader field="prsMergedCount" label="PRs" sortField={sortField} sortDir={sortDir} onSort={onSort} className="hidden lg:table-cell" />
            <AdminSortableHeader field="reviewsSubmittedCount" label="Reviews" sortField={sortField} sortDir={sortDir} onSort={onSort} className="hidden xl:table-cell" />
            <AdminSortableHeader field="activeDays" label="Days" sortField={sortField} sortDir={sortDir} onSort={onSort} className="hidden xl:table-cell" />
            <AdminSortableHeader field="totalStars" label="Stars" sortField={sortField} sortDir={sortDir} onSort={onSort} className="hidden xl:table-cell" />
            <AdminSortableHeader field="fetchedAt" label="Updated" sortField={sortField} sortDir={sortDir} onSort={onSort} className="hidden md:table-cell" />
            <AdminHeaderCell className="w-10">
              <span className="sr-only">Actions</span>
            </AdminHeaderCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke">
          {users.length === 0 ? (
            <tr>
              <td
                colSpan={12}
                className="px-3 py-12 text-center text-sm text-text-secondary"
              >
                {search ? "No users match your search." : "No users found."}
              </td>
            </tr>
          ) : (
            users.map((user) => (
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
                        alt={`${user.handle}'s avatar`}
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
                    aria-label={`View badge SVG for ${user.handle}`}
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
  );
}
