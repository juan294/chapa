import { SCORING_POLICY } from "@chapa/shared";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveRequestAuth } from "@/lib/auth/resolve-request-auth";
import { rateLimitStrict } from "@/lib/cache/redis";
import { getClientIp, NO_TRUSTED_IP } from "@/lib/http/client-ip";
import { isInsightsEnabled } from "@/lib/feature-flags";
import { MAX_INSIGHTS_BYTES } from "@/lib/insights/validation";
import { dbStoreCraftReportV7 } from "@/lib/db/craft-v7";
import { parseInsightsReportV7 } from "@/lib/insights/report-v7";
import { captureServerError, withErrorCapture } from "@/lib/analytics/server-errors";
import { log } from "@/lib/log";
import { prepareReportCraftImport } from "@/lib/insights/report-craft-import";
import { dbStoreReportCraft } from "@/lib/db/report-craft";
import { materializeCurrentObservedReceipt } from "@/lib/profile/issue-receipt";
import { observedReceiptViewModel } from "@/lib/profile/score-view-model";
import { issueReceiptVerificationV7 } from "@/lib/verification/store";
import { invalidateBadgeSvgCacheForHandle, isBadgeCacheRefreshed } from "@/lib/render/badge-svg-cache";

/**
 * POST /api/insights — Upload an insights report and compute Craft.
 * Auth: Bearer token (CLI token or GitHub PAT) or session cookie.
 * Rate limited: 10 req/IP/hour (before auth).
 *
 * #1335 phase 5 — the v6 legacy InsightsUpload/computeCraftScore/
 * dbUpsertToolInsights path is retired: nothing reads its output anymore
 * (`/api/insights/:handle` and `/api/profile/:handle` read Craft from the
 * current v7.2 receipt only). The archived v7 schemaVersion branch below
 * (immutable, pre-v7.2) is unaffected.
 *
 * BE-H2 (#860): IP rate-limit runs BEFORE resolveRequestAuth to prevent
 * unauthenticated callers from triggering outbound GitHub calls.
 */
export const POST = withErrorCapture("/api/insights", async (request: NextRequest) => {
  if (!(await isInsightsEnabled())) {
    return NextResponse.json({ error: "Feature not available" }, { status: 403 });
  }

  // BE-H2 (#860): IP rate-limit BEFORE auth.
  const ip = getClientIp(request);
  const ipRlKey =
    ip === NO_TRUSTED_IP
      ? "ratelimit:insights-ip:no-ip"
      : `ratelimit:insights-ip:${ip}`;
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

  // Parse body
  let rawBody: string;
  let body: unknown;
  try {
    rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_INSIGHTS_BYTES) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // #1335 phase 5 — the retired DB-backed render-selector flag is gone; v7.2 is
  // the only rendered policy, so a caller negotiating any other policy is
  // rejected before writing.
  const expectedPolicy = request.headers.get("X-Chapa-Scoring-Policy");
  if (expectedPolicy && expectedPolicy !== SCORING_POLICY) {
    return NextResponse.json({ error: "policy_changed", persisted: false }, { status: 409 });
  }

  if (body && typeof body === "object" && "schemaVersion" in body && body.schemaVersion === "v7.2") {
    if (Array.isArray(body) || Object.keys(body).some(key => !["schemaVersion", "report", "supersedesReportId"].includes(key))
      || !("report" in body)
      || ("supersedesReportId" in body && (typeof body.supersedesReportId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.supersedesReportId)))) {
      return NextResponse.json({ error: "Invalid insights data", persisted: false }, { status: 400 });
    }
    const capturedAt = new Date().toISOString();
    let prepared;
    try { prepared = await prepareReportCraftImport(body.report, capturedAt); }
    catch { return NextResponse.json({ error: "Invalid insights data", persisted: false }, { status: 400 }); }
    const handle = auth.handle.toLowerCase();
    const stored = await dbStoreReportCraft(handle, handle, prepared, {
      ...("supersedesReportId" in body ? { supersedesReportId: body.supersedesReportId as string } : {}),
    });
    if (stored.status === "correction_required") return NextResponse.json({ error: "same_period_requires_explicit_correction", persisted: false, supersedesReportId: stored.supersedesReportId }, { status: 409 });
    if (stored.status !== "stored") return NextResponse.json({ error: "Insights storage unavailable", persisted: false }, { status: 503 });
    const pending = { success: true, persisted: true, schemaVersion: "v7.2", uploadId: stored.reportId, reportSelection: stored.selection, publication: "pending", refreshed: false, scoring: null, craft: null };
    try {
      const result = await materializeCurrentObservedReceipt(handle, { token: auth.token, referenceTime: capturedAt,
        reportUpdate: { endExclusive: prepared.calculation.inputs.reportPeriod.endExclusive } });
      if (result.status === "unavailable" || result.freshness !== "current") return NextResponse.json(pending);
      // A retry repairs verification and invalidation for the exact authoritative
      // envelope, without another family, provider refresh, or upload cooldown.
      await issueReceiptVerificationV7(handle, handle, result.snapshot.receipt);
      const scoring = observedReceiptViewModel(handle, result.snapshot, Date.parse(capturedAt));
      const invalidated = await invalidateBadgeSvgCacheForHandle(handle, capturedAt.slice(0, 10));
      revalidatePath(`/u/${handle}`);
      return NextResponse.json({ ...pending, publication: result.status === "issued" ? "published" : "unchanged",
        refreshed: isBadgeCacheRefreshed(invalidated), scoring, craft: scoring.reportCraft });
    } catch (error) {
      void captureServerError({ error, route: "/api/insights", statusCode: 503 });
      return NextResponse.json(pending);
    }
  }

  // Archived v7 schemaVersion branch (pre-v7.2, immutable format) — unaffected
  // by the v6 retirement above.
  if (body && typeof body === "object" && "schemaVersion" in body) {
    const referenceTime = new Date().toISOString();
    let report;
    try { report = parseInsightsReportV7(body, referenceTime); }
    catch { return NextResponse.json({ error: "Invalid insights data" }, { status: 400 }); }
    const limit = await rateLimitStrict(`ratelimit:insights:${auth.handle.toLowerCase()}`, 10, 86400);
    if (!limit.allowed) return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429, headers: { "Retry-After": "86400" } });
    try {
      const stored = await dbStoreCraftReportV7(auth.handle, report, referenceTime);
      // A descriptive report changes no engineering counts and issues no rubric verdict.
      return NextResponse.json({ success: true, persisted: true, schemaVersion: "v7", uploadId: stored.uploadId });
    } catch {
      log("error", "[insights] Craft v7 persistence failed", { route: "/api/insights" });
      void captureServerError({ error: new Error("Craft v7 persistence failed"), route: "/api/insights", statusCode: 503 });
      return NextResponse.json({ error: "Insights storage unavailable" }, { status: 503 });
    }
  }

  return NextResponse.json({ error: "Invalid insights data" }, { status: 400 });
});
