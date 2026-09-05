import { canonicalJson, verifyScoreReceipt } from "@chapa/shared";
import { type NextRequest, NextResponse } from "next/server";
import { getReceiptVerificationV7, getVerificationRecord } from "@/lib/verification/store";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { getBaseUrl } from "@/lib/env";
import { captureServerError, withErrorCapture } from "@/lib/analytics/server-errors";
import { toPublicVerificationRecord } from "@/lib/verification/types";
import { parseVerificationTokenV7, VERIFICATION_HASH_PATTERN } from "@/lib/verification/constants";

// Legacy pre-v2 payload hashes remain valid through this 90-day deprecation window.
export const LEGACY_PRE_V2_DEADLINE = "2026-07-19";

export const GET = withErrorCapture("/api/verify/[hash]", async (
  request: NextRequest,
  ctx,
) => {
  const { hash } = await (ctx as { params: Promise<{ hash: string }> }).params;

  if (hash.startsWith("v7.")) return verifyV7(request, hash, false);

  // Validate hash format. Legacy 32-char pre-v2 hashes remain accepted until
  // LEGACY_PRE_V2_DEADLINE, after which the regex can be tightened in follow-up work.
  if (!VERIFICATION_HASH_PATTERN.test(hash)) {
    return NextResponse.json(
      { error: "Invalid hash format. Expected 8, 16, or 32 hex characters." },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  // Rate limit: 30 requests per IP per 60 seconds
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:verify:${ip}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60", "Access-Control-Allow-Origin": "*" } },
    );
  }

  // Look up record
  const record = await getVerificationRecord(hash);
  if (!record) {
    return NextResponse.json(
      { status: "not_found", hash, message: "No verification record found for this hash." },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const baseUrl = getBaseUrl();

  return NextResponse.json(
    {
      version: "v6",
      status: "legacy_record",
      arithmetic: "replay_unavailable",
      hash,
      data: toPublicVerificationRecord(record),
      verifyUrl: `${baseUrl}/verify/${hash}`,
      badgeUrl: `${baseUrl}/u/${record.handle}/badge.svg`,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
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
