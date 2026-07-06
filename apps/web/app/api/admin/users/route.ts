import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import {
  dbGetAdminUsers,
  type AdminSortField,
} from "@/lib/db/admin-users";
import { dbTimeoutOr504 } from "@/lib/async/with-timeout";
import { withErrorCapture } from "@/lib/analytics/server-errors";

const VALID_SORT_FIELDS: AdminSortField[] = [
  "handle",
  "adjustedComposite",
  "rawScore",
  "confidence",
  "commitsTotal",
  "prsMergedCount",
  "reviewsSubmittedCount",
  "activeDays",
  "totalStars",
  "tier",
  "archetype",
  "registeredAt",
  "lastSnapshotDate",
];

/**
 * GET /api/admin/users
 *
 * Server-side paginated, sorted, and filtered admin user list.
 * Data comes from Supabase `admin_users` view (users + latest snapshot).
 */
export const GET = withErrorCapture("/api/admin/users", async (request: NextRequest) => {
  // Pagination/sort/search each trigger a distinct request; the shared
  // adminAuth default (10/60s) is too tight for normal dashboard use (#993).
  const authError = await adminAuth(request, "ratelimit:admin-users", 30, 60);
  if (authError) return authError;

  // Parse query params
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10) || 1;
  const limit = parseInt(url.searchParams.get("limit") ?? "25", 10) || 25;
  const sort = (url.searchParams.get("sort") ?? "adjustedComposite") as AdminSortField;
  const dir = (url.searchParams.get("dir") ?? "desc") as "asc" | "desc";
  const search = url.searchParams.get("search") ?? undefined;
  const tier = url.searchParams.get("tier") ?? undefined;
  const archetype = url.searchParams.get("archetype") ?? undefined;

  // Validate sort field
  if (!VALID_SORT_FIELDS.includes(sort)) {
    return NextResponse.json(
      { error: "Invalid sort field" },
      { status: 400 },
    );
  }

  // Validate dir
  if (dir !== "asc" && dir !== "desc") {
    return NextResponse.json(
      { error: "Invalid sort direction" },
      { status: 400 },
    );
  }

  // Single Supabase call replaces: dbGetUsers + cacheMGet + computeImpactV6 + EMA
  const result = await dbTimeoutOr504(
    dbGetAdminUsers({ page, limit, sort, dir, search, tier, archetype }),
    "dbGetAdminUsers",
  );
  if (result instanceof NextResponse) return result;

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
});
