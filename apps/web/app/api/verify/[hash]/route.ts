import { type NextRequest, NextResponse } from "next/server";
import { getVerificationRecord } from "@/lib/verification/store";
import { rateLimit } from "@/lib/cache/redis";

const HASH_PATTERN = /^[0-9a-f]{8}([0-9a-f]{8})?$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;

  // Validate hash format
  if (!HASH_PATTERN.test(hash)) {
    return NextResponse.json(
      { error: "Invalid hash format. Expected 8 or 16 hex characters." },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  // Rate limit: 30 requests per IP per 60 seconds
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://chapa.thecreativetoken.com";

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
}

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
