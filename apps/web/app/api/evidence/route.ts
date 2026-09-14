import { withdrawReceiptPublicationV7 } from "@/lib/verification/cleanup";
import { captureServerError, withErrorCapture } from "@/lib/analytics/server-errors";
import { type NextRequest, NextResponse } from "next/server";
import { createScoringWindow } from "@chapa/shared";
import { resolveRequestAuth } from "@/lib/auth/resolve-request-auth";
import { assertHandleOwnership } from "@/lib/auth/assert-handle-ownership";
import { rateLimitStrict } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { MAX_EVIDENCE_BYTES, parseLedgerCommand } from "@/lib/evidence/validation";
import { dbReadEngineeringArtifact, dbReadEngineeringEvidence, dbWriteEngineeringEvidence, LedgerStorageError } from "@/lib/db/engineering-evidence";
import { invalidateProfileReadModels } from "@/lib/profile/post-write-invalidation";
import { issueScoreReceiptIfConsented } from "@/lib/profile/issue-receipt";

const headers = { "Cache-Control": "private, no-store" };
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers }); }
function failure(error: unknown) {
  const code = error instanceof LedgerStorageError ? error.code : "unavailable";
  const status = code === "42501" ? 403 : code === "40001" || code === "23505" ? 409 : code.startsWith("22") || code.startsWith("23") ? 400 : 503;
  return json({ error: status === 403 ? "Evidence access denied" : status === 409 ? "Revision conflict; reload the ledger" : status === 400 ? "Invalid evidence operation" : "Evidence storage unavailable" }, status);
}
async function authenticate(request: NextRequest) {
  const limit = await rateLimitStrict(`ratelimit:evidence-ip:${getClientIp(request)}`, 120, 3600);
  if (!limit.allowed) return json({ error: "Too many requests" }, 429);
  const auth = await resolveRequestAuth(request);
  if (!auth) return json({ error: "Authentication required" }, 401);
  const accountLimit = await rateLimitStrict(`ratelimit:evidence:${auth.handle.toLowerCase()}`, 240, 3600);
  return accountLimit.allowed ? auth : json({ error: "Too many requests" }, 429);
}
async function boundedBody(request: NextRequest): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) return text + decoder.decode();
      bytes += part.value.byteLength;
      if (bytes > MAX_EVIDENCE_BYTES) { await reader.cancel(); return null; }
      text += decoder.decode(part.value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}

/** Authenticated private ledger. Uploaded artifacts are stored as text, never fetched or rendered as HTML. */
async function postEvidence(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const referenceTime = new Date().toISOString();
  let command;
  try {
    const raw = await boundedBody(request);
    if (raw === null) return json({ error: "Evidence payload too large" }, 413);
    command = parseLedgerCommand(JSON.parse(raw), referenceTime);
  } catch { return json({ error: "Invalid evidence command" }, 400); }
  if (command.action !== "assessment") {
    const denied = assertHandleOwnership(auth, command.owner);
    if (denied) return denied;
  }
  try {
    const withdrawing = command.action === "withdraw" || (command.action === "consent" && !command.enabled);
    const result = withdrawing
      ? await withdrawReceiptPublicationV7(command.owner, auth.handle, true)
      : await dbWriteEngineeringEvidence(auth.handle, command, referenceTime);
    await invalidateProfileReadModels(command.owner, { stats: true, craft: true, snapshot: true, history: true, badgeSvg: true });

    // #1311 — granting consent is what makes a receipt issuable, so issue one
    // now. Without this the settings page reported publication as on while the
    // badge kept showing a legacy v6 aggregate until the next refresh or the
    // next hourly warm pass, which is up to an hour of the product
    // contradicting itself about the thing the user just turned on.
    // Awaited: the response reports the outcome of the opt-in.
    if (command.action === "consent" && command.enabled) {
      await issueScoreReceiptIfConsented(command.owner);
    }
    // Revocation is already committed. Empty retries cannot re-identify erased
    // owner/revision links, so they await the recurring content-free sweep.
    if (withdrawing && result.success === false) {
      const cleanup = result.cleanup as { status?: string };
      return cleanup.status === "pending"
        ? json({ ...result, message: "Publication withdrawn; receipt cache cleanup remains unconfirmed pending the background sweep." }, 202)
        : json({ ...result, error: "Publication withdrawn; cache cleanup failed. Background sweeps will retry known revoked and retired cache entries." }, 503);
    }
    return json(result);
  } catch (error) { return failure(error); }
}
async function getEvidence(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const owner = request.nextUrl.searchParams.get("owner") ?? auth.handle.toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(owner)) return json({ error: "Invalid evidence owner" }, 400);
  const artifact = request.nextUrl.searchParams.get("artifactReferenceId");
  if (artifact !== null) {
    if (!/^[0-9a-f-]{36}$/i.test(artifact)) return json({ error: "Invalid artifact reference" }, 400);
    try {
      const stored = await dbReadEngineeringArtifact(owner, auth.handle, artifact);
      return stored ? json(stored) : json({ error: "Artifact body expired or unavailable" }, 404);
    } catch (error) { return failure(error); }
  }
  let window;
  try {
    const reference = request.nextUrl.searchParams.get("referenceTime") ?? new Date().toISOString();
    window = createScoringWindow(reference);
    if (Date.parse(reference) > Date.now()) return json({ error: "Future ledger time" }, 400);
  } catch { return json({ error: "Invalid ledger time" }, 400); }
  try { return json(await dbReadEngineeringEvidence(owner, auth.handle, window)); }
  catch (error) { return failure(error); }
}

/** The shared monitor redacts tokens, but not arbitrary private artifact text.
 * Contain unexpected failures here and emit only a fixed, content-free error. */
async function privateEvidenceResponse(operation: () => Promise<Response>): Promise<Response> {
  try {
    const response = await operation();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    void captureServerError({ route: "/api/evidence", statusCode: 503, error: new Error("Evidence request failed") });
    return failure(undefined);
  }
}
export const POST = withErrorCapture("/api/evidence", request => privateEvidenceResponse(() => postEvidence(request)));
export const GET = withErrorCapture("/api/evidence", request => privateEvidenceResponse(() => getEvidence(request)));
