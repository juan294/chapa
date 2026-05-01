import { type NextRequest, NextResponse } from "next/server";
import { getVerificationRecord } from "@/lib/verification/store";
import { rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { getBaseUrl } from "@/lib/env";
import { withErrorCapture } from "@/lib/analytics/server-errors";

// Legacy pre-v2 payload hashes remain valid through this 90-day deprecation window.
export const LEGACY_PRE_V2_DEADLINE = "2026-07-19";
const HASH_PATTERN = /^(?:[0-9a-f]{8}|[0-9a-f]{16}|[0-9a-f]{32})$/;

export const GET = withErrorCapture("/api/verify/[hash]", async (
  request: NextRequest,
  ctx,
) => {
  const { hash } = await (ctx as { params: Promise<{ hash: string }> }).params;

  // Validate hash format. Legacy 32-char pre-v2 hashes remain accepted until
  // LEGACY_PRE_V2_DEADLINE, after which the regex can be tightened in follow-up work.
  if (!HASH_PATTERN.test(hash)) {
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
      status: "verified",
      hash,
      data: record,
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
