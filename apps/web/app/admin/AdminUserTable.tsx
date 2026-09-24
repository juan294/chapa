import { memo, useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { AdminUser, SortField, SortDir } from "./admin-types";
import { ARCHETYPE_COLOR, TIER_COLOR, tierBadgeClasses, formatDate } from "./admin-types";
import { AdminSortableHeader, AdminHeaderCell } from "./AdminSortableHeader";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";

// ---------------------------------------------------------------------------
// AdminUserTableRow — memoized row component
// ---------------------------------------------------------------------------

interface AdminUserTableRowProps {
  user: AdminUser;
  hasImgError: boolean;
  onImgError: (handle: string) => void;
}

const AdminUserTableRow = memo(function AdminUserTableRow({
  user,
  hasImgError,
  onImgError,
}: AdminUserTableRowProps) {
  const { t } = useTranslation();
  const avatarAlt = interpolate(t('aria.avatarAlt') as string, { handle: user.handle });
  return (
    <tr
      className="transition-colors hover:bg-amber/[0.03]"
    >
      {/* Developer */}
      <td className="px-3 py-2.5">
        <Link
          href={`/u/${user.handle}`}
          className="flex items-center gap-2.5 group"
        >
          {user.avatarUrl && !hasImgError ? (
            <Image
              src={user.avatarUrl}
              alt={avatarAlt}
              width={28}
              height={28}
              className="h-7 w-7 rounded-full img-outline"
              onError={() => onImgError(user.handle)}
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber/10 text-xs font-semibold text-amber-text">
              {user.handle.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-heading text-sm text-text-primary group-hover:text-amber-text transition-colors">
              {user.handle}
              {user.policyVersion && <span className="ml-2 text-xs text-text-secondary">{user.policyVersion}</span>}
            </p>
            {user.lastSnapshotDate === null ? (
              <p className="text-xs text-text-secondary">no data yet</p>
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
          <span className="text-xs text-text-secondary">&mdash;</span>
        )}
      </td>

      {/* Tier */}
      <td className="px-3 py-2.5">
        {user.tier ? (
          <span className={tierBadgeClasses(user.tier)}>
            {user.tier}
          </span>
        ) : (
          <span className="text-xs text-text-secondary">&mdash;</span>
        )}
      </td>

      {/* Score */}
      <td className="px-3 py-2.5">
        {user.adjustedComposite != null ? (
          <span className={`font-heading text-sm tabular-nums ${TIER_COLOR[user.tier ?? ""] ?? "text-text-secondary"}`}>
            {user.adjustedComposite}
          </span>
        ) : (
          <span className="text-xs text-text-secondary">&mdash;</span>
        )}
      </td>

      {/* Raw Score */}
      <td className="hidden md:table-cell px-3 py-2.5">
        {user.rawScore != null ? (
          <span className="font-heading text-xs tabular-nums text-text-secondary">
            {user.policyVersion === "v7.2" ? user.exactScore : user.rawScore}
          </span>
        ) : (
          <span className="text-xs text-text-secondary">&mdash;</span>
        )}
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
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[3px] p-1 text-text-secondary hover:text-amber-text hover:bg-amber/[0.06] transition-colors"
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
  );
});

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
      <table className="w-full text-sm" aria-label="Registered users">
        <thead>
          <tr className="border-b border-stroke">
            <AdminSortableHeader field="handle" label="Developer" sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <AdminSortableHeader field="archetype" label="Archetype" sortField={sortField} sortDir={sortDir} onSort={onSort} className="hidden sm:table-cell" />
            <AdminSortableHeader field="tier" label="Tier" sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <AdminSortableHeader field="adjustedComposite" label="Score" sortField={sortField} sortDir={sortDir} onSort={onSort} />
            <AdminSortableHeader field="rawScore" label="Exact / legacy raw" sortField={sortField} sortDir={sortDir} onSort={onSort} className="hidden md:table-cell" />
            <AdminSortableHeader field="lastSnapshotDate" label="Updated" sortField={sortField} sortDir={sortDir} onSort={onSort} className="hidden md:table-cell" />
            {/* Keep the absolute sr-only label inside the table's scroll area. */}
            <AdminHeaderCell className="relative w-10">
              <span className="sr-only">Actions</span>
            </AdminHeaderCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke">
          {users.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-3 py-12 text-center text-sm text-text-secondary"
              >
                {search ? "No users match your search." : "No users found."}
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <AdminUserTableRow
                key={user.handle}
                user={user}
                hasImgError={imgErrors.has(user.handle)}
                onImgError={handleImgError}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
