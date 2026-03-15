import { type NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import {
  dbGetAdminUsers,
  type AdminSortField,
} from "@/lib/db/admin-users";
import { withTimeout, TimeoutError, DB_TIMEOUT_MS } from "@/lib/async/with-timeout";

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
export async function GET(request: NextRequest) {
  // Rate limit: 10 requests per IP per 60 seconds
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:admin-users:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // Auth: require session cookie
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieHeader = request.headers.get("cookie");
  const session = readSessionCookie(cookieHeader, sessionSecret);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin check
  if (!isAdminHandle(session.login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // Single Supabase call replaces: dbGetUsers + cacheMGet + computeImpactV4 + EMA
  let result;
  try {
    result = await withTimeout(
      dbGetAdminUsers({ page, limit, sort, dir, search, tier, archetype }),
      DB_TIMEOUT_MS,
      "dbGetAdminUsers",
    );
  } catch (err) {
    if (err instanceof TimeoutError) {
      return NextResponse.json(
        { error: "Database request timeout" },
        { status: 504 },
      );
    }
    throw err;
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
