import { canonicalJson, verifyScoreReceipt } from "@chapa/shared";
import { type NextRequest, NextResponse } from "next/server";
import { getReceiptVerificationV7 } from "@/lib/verification/store";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { captureServerError, withErrorCapture } from "@/lib/analytics/server-errors";
import { parseVerificationTokenV7, VERIFICATION_HASH_PATTERN } from "@/lib/verification/constants";

/** #1335 phase 5 — v6 verification codes and `verification_records` are retired.
 * A well-formed legacy hex code is terminal by design (410), not a lookup. */
function retiredV6CodeResponse() {
  return NextResponse.json(
    {
      status: "retired_v6_code",
      message: "This is a retired v6 verification code. Current badges use v7.2 receipt codes.",
    },
    { status: 410, headers: { "Access-Control-Allow-Origin": "*" } },
  );
}

export const GET = withErrorCapture("/api/verify/[hash]", async (
  request: NextRequest,
  ctx,
) => {
  const { hash } = await (ctx as { params: Promise<{ hash: string }> }).params;

  if (hash.startsWith("v7.")) return verifyV7(request, hash, false);

  // A legacy pre-v2/v2 hex code (8/16/32 chars) is recognized but retired.
  // Anything else is simply malformed input, not a retired code.
  if (!VERIFICATION_HASH_PATTERN.test(hash)) {
    return NextResponse.json(
      { error: "Invalid hash format. Expected a v7.<revision>.<signature> receipt token." },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  return retiredV6CodeResponse();
});

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

const V7_HEADERS = { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };
function v7Response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: V7_HEADERS });
}

/** Read-only comparison, bounded before parsing; submitted content is never logged or echoed. */
export const POST = withErrorCapture("/api/verify/[hash]", async (request, ctx) => {
  try {
    const { hash } = await (ctx as { params: Promise<{ hash: string }> }).params;
    return await verifyV7(request, hash, true);
  } catch {
    return v7Response({ error: "Receipt verification unavailable" }, 503);
  }
});

async function verifyV7(request: NextRequest, token: string, compare: boolean) {
  try {
    if (!parseVerificationTokenV7(token)) return v7Response({ error: "Invalid receipt token" }, 400);
    const rl = await rateLimit(`ratelimit:verify:${getClientIp(request)}`, 30, 60);
    if (!rl.allowed) return v7Response({ error: "Too many requests" }, 429);
    let submitted: string | null = null;
    if (compare) {
      const reader = request.body?.getReader();
      if (!reader) return v7Response({ error: "Invalid receipt submission" }, 400);
      let bytes = 0;
      const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 2 * 1024 * 1024) { await reader.cancel(); return v7Response({ error: "Receipt submission too large" }, 413); }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
      try {
        const receipt = await verifyScoreReceipt(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))));
        submitted = canonicalJson(receipt);
      } catch { return v7Response({ error: "Invalid receipt submission" }, 400); }
    }
    const result = await getReceiptVerificationV7(token);
    if (!result) return v7Response({ status: "not_found" }, 404);
    if (result.status === "revoked") return v7Response(result, 410);
    if (compare) return v7Response({ ...result, submittedReceiptMatches: submitted === canonicalJson(result.envelope.receipt) });
    return v7Response(result);
  } catch {
    void captureServerError({ route: "/api/verify/[hash]", statusCode: 503, error: new Error("Receipt verification unavailable") });
    return v7Response({ error: "Receipt verification unavailable" }, 503);
  }
}
