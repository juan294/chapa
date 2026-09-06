import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { rateLimit } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";
import { computeImpactV6 } from "@/lib/impact/v6";
import { getSessionGitHubToken } from "@/lib/auth/github-session-token";
import { captureServerEvent, withErrorCapture } from "@/lib/analytics/server-errors";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { findUnusableSourceLinks } from "@/lib/platform/source-diagnostics";
import { issueScoreReceiptIfConsented } from "@/lib/profile/issue-receipt";

/**
 * POST /api/generate
 *
 * Warm the badge cache for the authenticated user by fetching their
 * GitHub stats and computing the Impact v6 profile. Called from the
 * /generating/:handle progress page after OAuth login.
 *
 * If the user's stats are already cached, getStats returns them
 * immediately — no redundant GitHub API calls.
 *
 * Rate limited: 10 requests per handle per hour.
 */
export const POST = withErrorCapture("/api/generate", async (request: NextRequest) => {
  const { session, error } = requireSession(request);
  if (error) return error;

  const handle = session.login;

  // Rate limit: 10 generates per handle per hour
  const rl = await rateLimit(
    `ratelimit:generate:${handle.toLowerCase()}`,
    10,
    3600,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const token = await getSessionGitHubToken(session);
  if (!token) {
    return NextResponse.json(
      { error: "Reauthentication required" },
      { status: 401 },
    );
  }

  let stats = await getStats(handle, token);

  // #1282/#1283 — This is a first-time signup's very first fetch, so there is
  // no last-known-good baseline for `getStats` to fall back on: a null here is
  // a hard 502 and the generating page tells the user to try again. Two ways
  // the session-token fetch fails that a retry with the SAME token cannot fix:
  //
  //   - the OAuth token carries no `repo` scope (OAUTH_SCOPES), so an account
  //     whose PR contributions are private reports a positive totalCount with
  //     an empty node sample, and `assessRawFetchIntegrity` rightly rejects it
  //     (#1282 — two signups on 2026-09-04 never got a badge this way);
  //   - GitHub's GraphQL timed out on a cold 365-day query (#1283).
  //
  // A tokenless call authenticates as the server GITHUB_TOKEN, which is
  // `repo`-scoped and private-inclusive — the same fetch the warm-cache cron
  // would make for this handle within the hour. Its result is classified
  // `authenticated`, so the cache-boundary rule already prevents a later
  // session-token fetch from downgrading it. If this attempt fails too, the
  // 502 below stands.
  if (!stats) {
    fireAndForget(
      () =>
        captureServerEvent("generate_session_fetch_failed", {
          handle: handle.toLowerCase(),
          fallback: "server_token",
        }),
      () => undefined,
    );
    stats = await getStats(handle);
  }

  if (!stats) {
    // A connected platform whose token can no longer be refreshed makes the
    // whole fetch null (see findUnusableSourceLinks). Retrying cannot fix
    // that, and a generic "something went wrong" leaves the user with no
    // action, so name the connection and send them to /settings instead.
    const unusable = await findUnusableSourceLinks(handle);
    if (unusable.length > 0) {
      return NextResponse.json(
        { error: `Reconnect ${unusable.join(", ")} to include it in your profile.`, staleSources: unusable },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch stats. Try again later." },
      { status: 502 },
    );
  }

  // Compute impact (also warms any downstream caches)
  computeImpactV6(stats);

  // #1311 — first badge generation is where a consented subject acquires their
  // first v7 receipt, so the badge they are about to see is the issued revision
  // rather than a legacy aggregate that a later refresh would silently replace.
  await issueScoreReceiptIfConsented(handle, token ? { token } : {});

  return NextResponse.json({ success: true, handle });
});
