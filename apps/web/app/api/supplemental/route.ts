import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAuth } from "@/lib/auth/resolve-request-auth";
import { cacheSet, cacheDel, rateLimitStrict } from "@/lib/cache/redis";
import { markStatsDirty } from "@/lib/cache/dirty-stats";
import { dbUpsertSupplemental } from "@/lib/db/supplemental";
import { isValidHandle, isValidEmuHandle, isValidStatsShape } from "@/lib/validation";
import { assertHandleOwnership } from "@/lib/auth/assert-handle-ownership";
import { invalidateProfileReadModels } from "@/lib/profile/post-write-invalidation";
import { getClientIp, NO_TRUSTED_IP } from "@/lib/http/client-ip";
import { createScoringWindow, type SupplementalStats } from "@chapa/shared";
import { SupplementalEvidenceConflict, parseSupplementalEvidenceV2 } from "@/lib/platform/evidence-aging";
import { dbStoreSupplementalEvidenceV2, readSupplementalEvidenceV2 } from "@/lib/db/supplemental-v7";
import { captureServerError, withErrorCapture } from "@/lib/analytics/server-errors";

const CACHE_TTL = 86400; // 24 hours
const MAX_SUPPLEMENTAL_BYTES = 256 * 1024;

export const POST = withErrorCapture("/api/supplemental", async (request: NextRequest) => {
  // 1. Require Bearer token (supplemental is CLI-only, no session cookie fallback)
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const ipRlKey =
    ip === NO_TRUSTED_IP
      ? "ratelimit:supplemental-ip:no-ip"
      : `ratelimit:supplemental-ip:${ip}`;
  const ipRl = await rateLimitStrict(ipRlKey, 10, 3600);
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

  // 2. Parse body after auth, with a raw-size cap before JSON decoding.
  let rawBody: string;
  let body: { schemaVersion?: string; targetHandle?: string; sourceHandle?: string; stats?: unknown };
  try {
    rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_SUPPLEMENTAL_BYTES) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON object" }, { status: 400 });
  }
  if (body.schemaVersion === "supplemental-v2") return uploadV2(body, auth);

  const { targetHandle, sourceHandle, stats } = body;

  // 3. Validate required fields
  if (!targetHandle || !sourceHandle || !stats) {
    return NextResponse.json({ error: "Missing required fields: targetHandle, sourceHandle, stats" }, { status: 400 });
  }

  if (!isValidHandle(targetHandle)) {
    return NextResponse.json({ error: "Invalid targetHandle" }, { status: 400 });
  }

  if (!isValidEmuHandle(sourceHandle)) {
    return NextResponse.json({ error: "Invalid sourceHandle" }, { status: 400 });
  }

  if (!isValidStatsShape(stats)) {
    return NextResponse.json({ error: "Invalid stats shape" }, { status: 400 });
  }

  // 4. SE-L2 (#890) + BE-S1 (#896): Verify token ownership BEFORE consuming the
  // per-handle rate-limit quota. An attacker cannot exhaust another handle's bucket
  // by sending their own valid token with a different targetHandle.
  // Rate-limit key is now derived from the authenticated handle, not targetHandle.
  const ownershipError = assertHandleOwnership(auth, targetHandle);
  if (ownershipError) return ownershipError;

  // 4b. Rate limit: 10 requests per targetHandle per 24 hours
  // Keyed on the validated targetHandle — ownership check above ensures the caller
  // is the owner, so this is effectively keyed on the authenticated handle.
  const rl = await rateLimitStrict(`ratelimit:supplemental:${targetHandle}`, 10, 86400);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests for this handle. Please try again later." },
      { status: 429, headers: { "Retry-After": "86400" } },
    );
  }

  // 5. Commit Supabase first, then publish Redis (hot read path). Redis has a
  // 24h TTL and is rebuilt from Supabase by warm-cache + by getStats() on
  // a Redis miss, so a missed CLI upload day no longer drops EMU data.
  // Supabase is the success criterion — Redis is best-effort.
  const supplemental: SupplementalStats = {
    targetHandle,
    sourceHandle,
    stats: stats as SupplementalStats["stats"],
    uploadedAt: new Date().toISOString(),
  };

  // Only committed inputs may become visible through the hot read path.
  const dbOk = await dbUpsertSupplemental(targetHandle, supplemental);

  if (!dbOk) {
    return NextResponse.json(
      { success: false, error: "Failed to persist supplemental stats" },
      { status: 500 },
    );
  }

  const supplementalKey = `supplemental:${targetHandle.toLowerCase()}`;
  const published = await cacheSet(supplementalKey, supplemental, CACHE_TTL)
    .catch(() => false);
  // A failed SET can leave the previous value alive. Evict it so getStats
  // falls back to the committed row instead of composing the old upload.
  const cacheRefreshed = published || await cacheDel(supplementalKey).catch(() => false);
  if (!cacheRefreshed) {
    await captureServerError({
      route: "/api/supplemental",
      statusCode: 200,
      error: new Error(`Supplemental stats committed but cache refresh deferred for ${targetHandle}`),
    });
  }

  // 6. Invalidate score-dependent read models and rendered badge artifact.
  // `stats: true` is load-bearing: it drops the composed stats entry so the
  // next getStats recomposes with this record. Without it the upload succeeds
  // and the score silently never moves. It deliberately does NOT clear
  // `stats:stale:v2:` — that baseline holds GitHub-derived data only and is
  // unaffected by a supplemental upload (#1060).
  await invalidateProfileReadModels(targetHandle, {
    stats: true,
    badgeSvg: true,
    snapshot: true,
    history: true,
  });

  // 7. Mark stats dirty (#826) so today's snapshot lock yields to the new
  // inputs and the user sees the updated score without waiting for tomorrow.
  await markStatsDirty(targetHandle);

  return NextResponse.json({ success: true, cacheRefreshed, eligibility: "historical_only", coverage: "legacy", reasonCode: "legacy_aggregate" });
});


async function uploadV2(body: { targetHandle?: string }, auth: { handle: string }) {
  if (typeof body.targetHandle !== "string" || !isValidHandle(body.targetHandle)) {
    return NextResponse.json({ error: "Invalid targetHandle" }, { status: 400 });
  }
  const ownershipError = assertHandleOwnership(auth, body.targetHandle);
  if (ownershipError) return ownershipError;
  const owner = auth.handle.toLowerCase();
  const referenceTime = new Date().toISOString();
  let value;
  try { value = parseSupplementalEvidenceV2(body, owner, referenceTime); }
  catch { return NextResponse.json({ error: "Invalid supplemental evidence v2" }, { status: 400 }); }
  const limit = await rateLimitStrict(`ratelimit:supplemental:${owner}`, 10, 86400);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests for this handle. Please try again later." }, { status: 429, headers: { "Retry-After": "86400" } });
  let stored;
  try { stored = await dbStoreSupplementalEvidenceV2(owner, value, referenceTime); }
  catch (error) {
    if (error instanceof SupplementalEvidenceConflict) return NextResponse.json({ success: false, persisted: false, error: "Conflicting immutable supplemental event" }, { status: 409 });
    return NextResponse.json({ success: false, persisted: false, error: "Failed to persist supplemental evidence" }, { status: 503 });
  }
  let cacheRefreshed = false;
  try {
    const asOf = new Date(Math.max(Date.now(), Date.parse(stored.uploadedAt))).toISOString();
    cacheRefreshed = (await readSupplementalEvidenceV2(owner, createScoringWindow(asOf))).cacheRefreshed;
  } catch {
    await captureServerError({ route: "/api/supplemental", statusCode: 200, error: new Error("Supplemental evidence committed; cache rebuild deferred") });
  }
  await invalidateProfileReadModels(owner, { stats: true, badgeSvg: true, snapshot: true, history: true });
  await markStatsDirty(owner);
  return NextResponse.json({ success: true, persisted: true, schemaVersion: "supplemental-v2", uploadId: stored.uploadId,
    uploadedAt: stored.uploadedAt, cacheRefreshed, eligibility: "dated_self_reported", coverage: "partial" });
}
