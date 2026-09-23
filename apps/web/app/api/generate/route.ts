import { postWriteScore } from "@/lib/profile/post-write-score";
import { readScoringRenderSelection } from "@/lib/scoring-render-selection";
import { type NextRequest, NextResponse, after } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { rateLimit } from "@/lib/cache/redis";
import { getStats } from "@/lib/github/client";
import { isGitHubUserNotFound } from "@/lib/github/not-found";
import { computeImpactV6 } from "@/lib/impact/v6";
import { getSessionGitHubToken } from "@/lib/auth/github-session-token";
import { captureServerError, captureServerEvent, withErrorCapture } from "@/lib/analytics/server-errors";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { findUnusableSourceLinks } from "@/lib/platform/source-diagnostics";
import { enqueueCollection, scheduleCollectionAdvance } from "@/lib/collection/enqueue";

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

  // The subject is the session's own login, which exists by construction;
  // should GitHub ever answer otherwise, treat it as a failed fetch below.
  const loadOwnStats = async (fetchToken?: string) => {
    const result = await (fetchToken === undefined ? getStats(handle) : getStats(handle, fetchToken));
    return isGitHubUserNotFound(result) ? null : result;
  };
  let stats = await loadOwnStats(token);
  let serverTokenRowFetched = false;

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
    stats = await loadOwnStats();
    serverTokenRowFetched = true;
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

  // #1335 phase 4 — first badge generation is called moments after the OAuth
  // callback's own "signup" enqueue, so this reuses the same `signup` reason
  // (idempotent no-op against an already-queued/running/complete job) rather
  // than `refresh`, which would reset an already-complete day's collection
  // back to queued and discard evidence this route did nothing to change.
  const scoringSelection = await readScoringRenderSelection();
  if (scoringSelection.enabled) {
    await enqueueCollection(handle, "signup");
    scheduleCollectionAdvance();
  }

  // LE-5-1 — the stats cache row is bound to the credential that fetched it
  // (source-context hashes the token into accessContextId), and the share
  // page materializes tokenless, as the server GITHUB_TOKEN. Warming only the
  // session-token row therefore left the owner's very first /u/:handle load
  // on a cold live fetch, which can time out and render the badge (served
  // from the SVG cache) beside an empty Impact Breakdown. Warm the row the
  // page will actually read, off the response path. The fallback above
  // already fetched it when it ran.
  if (!serverTokenRowFetched) {
    after(async () => {
      try {
        await getStats(handle);
      } catch (error) {
        await captureServerError({ route: "/api/generate", statusCode: 200, error });
      }
    });
  }

  const scoringStatus = await postWriteScore(handle, scoringSelection);

  return NextResponse.json({ success: true, handle, ...(scoringStatus ? { scoringStatus } : { policyVersion: "v6" }) });
});
