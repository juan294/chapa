import { type NextRequest, NextResponse } from "next/server";
import { resolveRequestAuth } from "@/lib/auth/resolve-request-auth";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp, NO_TRUSTED_IP } from "@/lib/http/client-ip";
import { updateCraftCache } from "@/lib/cache/craft-cache";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { revalidatePath } from "next/cache";
import { invalidateProfileReadModels } from "@/lib/profile/post-write-invalidation";
import {
  materializeOrchestratedProfile,
  persistOrchestratedSnapshot,
} from "@/lib/profile/orchestrated-profile";
import { withErrorCapture } from "@/lib/analytics/server-errors";

/**
 * POST /api/recalculate — Force-recalculate impact score.
 *
 * Fetches stats (cached or fresh), reads the stored craft score, computes
 * fresh impact, replaces today's snapshot, and returns the new score.
 *
 * Auth: Bearer token (CLI token or GitHub PAT) or session cookie.
 * Rate limited: 20 requests/handle/hour.
 */
export const POST = withErrorCapture("/api/recalculate", async (request: NextRequest) => {
  // BE-H2 (#860): IP rate-limit BEFORE auth — prevents bogus tokens from burning
  // the shared GitHub API quota via fetchGitHubUser calls in resolveRequestAuth.
  const ip = getClientIp(request);
  const ipRlKey =
    ip === NO_TRUSTED_IP
      ? "ratelimit:recalculate-ip:no-ip"
      : `ratelimit:recalculate-ip:${ip}`;
  const ipRl = await rateLimit(ipRlKey, 10, 3600);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const auth = await resolveRequestAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const handle = auth.handle.toLowerCase();

  // Rate limit: 20 per handle per hour
  const rl = await rateLimit(`ratelimit:recalculate:${handle}`, 20, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const materialized = await materializeOrchestratedProfile(handle, {
    token: auth.token,
  });

  if (!materialized) {
    return NextResponse.json(
      { error: "Could not load stats. Try again later." },
      { status: 502 },
    );
  }

  // #1076 — persistOrchestratedSnapshot's #1003 gate would refuse to persist
  // stats that look incomplete/poisoned anyway; check it here so the
  // intentional skip (422) is distinguishable from a genuine write failure
  // (500) up front, rather than inferring the reason from a bare `!persisted`.
  if (!materialized.statsComplete) {
    return NextResponse.json(
      {
        error: "Recalculated data looks incomplete and was not saved. Try again later.",
        reason: "stats_incomplete",
      },
      { status: 422 },
    );
  }

  const persisted = await persistOrchestratedSnapshot(handle, materialized, {
    mode: "replace",
  });
  if (!persisted) {
    return NextResponse.json(
      { error: "Could not save recalculated profile. Try again later." },
      { status: 500 },
    );
  }

  await invalidateProfileReadModels(handle, {
    badgeSvg: true,
    snapshot: true,
    history: true,
  });

  // Update craft cache after the durable snapshot write succeeds.
  const craftResult = materialized.craftResult;
  if (craftResult) {
    fireAndForget(() => updateCraftCache(handle, craftResult), () => undefined);
  }

  revalidatePath(`/u/${handle}`);

  return NextResponse.json({
    success: true,
    adjustedComposite: materialized.displayImpact.adjustedComposite,
    displayAdjustedComposite: materialized.displayImpact.adjustedComposite,
    rawAdjustedComposite: materialized.rawImpact.adjustedComposite,
    compositeScore: materialized.displayImpact.compositeScore,
    dimensions: materialized.displayImpact.dimensions,
    archetype: materialized.displayImpact.archetype,
    tier: materialized.displayImpact.tier,
    profileType: materialized.displayImpact.profileType,
    craftScore: materialized.craftResult?.craftScore ?? null,
    craftTier: materialized.craftResult?.tier ?? null,
  });
});
