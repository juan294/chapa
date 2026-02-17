// ---------------------------------------------------------------------------
// Shared types for admin dashboard components
// ---------------------------------------------------------------------------

export interface AdminUser {
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

export type SortField =
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

export type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const TIER_ORDER: Record<string, number> = {
  Elite: 4,
  High: 3,
  Solid: 2,
  Emerging: 1,
};

export const ARCHETYPE_COLOR: Record<string, string> = {
  Builder: "text-archetype-builder",
  Guardian: "text-archetype-guardian",
  Marathoner: "text-archetype-marathoner",
  Polymath: "text-archetype-polymath",
  Balanced: "text-archetype-balanced",
  Emerging: "text-archetype-emerging",
};

export const TIER_COLOR: Record<string, string> = {
  Elite: "text-amber",
  High: "text-terminal-green",
  Solid: "text-text-primary",
  Emerging: "text-text-secondary",
};

export function tierBadgeClasses(tier: string): string {
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

export function formatDate(iso: string): string {
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

export function sortUsers(
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
