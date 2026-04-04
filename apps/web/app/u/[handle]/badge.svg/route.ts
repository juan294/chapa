import { type NextRequest, NextResponse, after } from "next/server";
import { getStats } from "@/lib/github/client";
import { computeImpactV6 } from "@/lib/impact/v6";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { getAvatarBase64 } from "@/lib/render/avatar";
import { readSessionCookie } from "@/lib/auth/github";
import { isValidHandle } from "@/lib/validation";
import { escapeXml } from "@/lib/render/escape";
import { rateLimit, trackBadgeGenerated } from "@/lib/cache/redis";
import { buildSnapshot } from "@/lib/history/snapshot";
import { dbInsertSnapshot } from "@/lib/db/snapshots";
import { dbUpsertUser } from "@/lib/db/users";
import { getCachedLatestSnapshot, updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import { generateVerificationCode } from "@/lib/verification/hmac";
import { storeVerificationRecord } from "@/lib/verification/store";
import type { VerificationRecord } from "@/lib/verification/types";
import { getClientIp } from "@/lib/http/client-ip";
import { notifyFirstBadge } from "@/lib/email/notifications";
import { getCachedCraftScore } from "@/lib/cache/craft-cache";
import { smoothScore } from "@/lib/impact/smoothing";
import { getTier } from "@/lib/impact/utils";
import { captureServerError } from "@/lib/analytics/server-errors";

const CACHE_HEADERS = {
  "Content-Type": "image/svg+xml",
  "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
  // Badge SVG is designed to be embedded in READMEs, iframes, etc.
  // These headers are set explicitly on the Response object to override the
  // catch-all frame-ancestors 'none' + X-Frame-Options DENY from next.config.ts,
  // which Next.js merges into all matching routes (see issue #270).
  "Content-Security-Policy": "frame-ancestors *",
  "X-Frame-Options": "ALLOWALL",
};

function fallbackSvg(handle: string, message: string): string {
  const safe = escapeXml(handle);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" rx="16" fill="#0C0D14" stroke="rgba(139,92,246,0.12)" stroke-width="2"/>
  <text x="60" y="80" font-family="'JetBrains Mono', monospace" font-size="42" font-weight="700" fill="#8B5CF6">CHAPA</text>
  <text x="60" y="120" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="18" fill="#9AA4B2">Developer Impact Badge</text>
  <text x="60" y="340" font-family="'JetBrains Mono', monospace" font-size="28" fill="#E6EDF3">@${safe}</text>
  <text x="60" y="400" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="16" fill="#9AA4B2">${escapeXml(message)}</text>
</svg>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;

  // Rate limit: 100 requests per IP per 60 seconds
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:badge:${ip}`, 100, 60);
  if (!rl.allowed) {
    return new NextResponse("Too many requests. Please try again later.", {
      status: 429,
      headers: {
        "Content-Type": "text/plain",
        "Retry-After": "60",
      },
    });
  }

  // Validate handle before any work
  if (!isValidHandle(handle)) {
    const svg = fallbackSvg(handle, "Invalid GitHub handle.");
    return new NextResponse(svg, {
      status: 400,
      headers: { "Content-Type": "image/svg+xml" },
    });
  }

  // Try to get an auth token from session (better rate limits)
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  let token: string | undefined;
  if (sessionSecret) {
    const session = readSessionCookie(
      request.headers.get("cookie"),
      sessionSecret,
    );
    if (session) token = session.token;
  }

  try {
    // Fetch stats (cache-first)
    const stats = await getStats(handle, token);
    if (!stats) {
      const svg = fallbackSvg(
        handle,
        "Could not load data — try again later.",
      );
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }

    // Fetch craft score, snapshot, and avatar in parallel — all are independent
    // I/O operations. Craft score feeds into computeImpactV6 as the 5th dimension.
    // Uses allSettled so a single DB/network error doesn't crash the entire badge.
    const [craftSettled, snapshotSettled, avatarSettled] = await Promise.allSettled([
      getCachedCraftScore(handle),
      getCachedLatestSnapshot(handle),
      stats.avatarUrl
        ? getAvatarBase64(handle, stats.avatarUrl)
        : Promise.resolve(undefined),
    ]);
    const craftResult = craftSettled.status === "fulfilled" ? craftSettled.value : null;
    const latestSnapshot = snapshotSettled.status === "fulfilled" ? snapshotSettled.value : null;
    const avatarDataUri = avatarSettled.status === "fulfilled" ? avatarSettled.value : undefined;

    // Compute impact (craft score feeds into the 5th pentagon dimension)
    const impact = computeImpactV6(stats, craftResult?.craftScore ?? undefined);

    // V5: Day-aware EMA smoothing — applies once per day, prevents feedback loop
    // on same-day repeated requests (smoothScore returns cached value for today).
    impact.adjustedComposite = smoothScore(impact.adjustedComposite, latestSnapshot);
    impact.tier = getTier(impact.adjustedComposite);

    // Generate verification code (returns null if secret is unset)
    const verification = generateVerificationCode(stats, impact);

    // Post-response work: use after() to guarantee completion on Vercel
    // (void promises may be killed when the serverless function freezes).
    // Operations run in parallel via allSettled — each has its own try/catch
    // so individual failures don't block others.
    after(() => {
      const ops: Promise<void>[] = [];

      if (verification) {
        const record: VerificationRecord = {
          handle: stats.handle.toLowerCase(),
          displayName: stats.displayName,
          adjustedComposite: impact.adjustedComposite,
          confidence: impact.confidence,
          tier: impact.tier,
          archetype: impact.archetype,
          dimensions: impact.dimensions,
          commitsTotal: stats.commitsTotal,
          prsMergedCount: stats.prsMergedCount,
          reviewsSubmittedCount: stats.reviewsSubmittedCount,
          generatedAt: verification.date,
          profileType: impact.profileType,
        };
        ops.push(storeVerificationRecord(verification.hash, record));
      }

      ops.push(trackBadgeGenerated(handle));
      ops.push(notifyFirstBadge(handle, impact));
      const snapshot = buildSnapshot(stats, impact);
      ops.push(
        dbInsertSnapshot(handle, snapshot).then((inserted) => {
          if (inserted) updateSnapshotCache(handle, snapshot);
        }),
      );

      // Persist profile fields so admin dashboard always has latest data
      if (stats.displayName || stats.avatarUrl) {
        ops.push(
          dbUpsertUser(handle, {
            displayName: stats.displayName ?? undefined,
            avatarUrl: stats.avatarUrl ?? undefined,
          }).catch(() => {}),
        );
      }

      return Promise.allSettled(ops);
    });

    // Render full badge
    const svg = renderBadgeSvg(stats, impact, {
      avatarDataUri,
      verificationHash: verification?.hash,
      verificationDate: verification?.date,
    });

    return new NextResponse(svg, { headers: CACHE_HEADERS });
  } catch (err) {
    void captureServerError({
      route: `/u/${handle}/badge.svg`,
      statusCode: 500,
      error: err,
    });

    const svg = fallbackSvg(handle, "Something went wrong — try again later.");
    return new NextResponse(svg, {
      status: 500,
      headers: { "Content-Type": "image/svg+xml" },
    });
  }
}
