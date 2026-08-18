import { NextRequest, NextResponse } from "next/server";

import {
  verifyWebhookSignature,
  fetchReceivedEmail,
  forwardEmail,
} from "@/lib/email/resend";
import { cacheDel, cacheSetNxStatus, rateLimit } from "@/lib/cache/redis";
import { getClientIp } from "@/lib/http/client-ip";
import { withErrorCapture } from "@/lib/analytics/server-errors";
import { log } from "@/lib/log";

const EMAIL_ID_RE = /^[a-f0-9-]{8,64}$/i;
const DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * POST /api/webhooks/resend
 *
 * Receives inbound email notifications from Resend via Svix webhook,
 * fetches the full email, and forwards it to the configured Gmail address.
 *
 * Resend retries on non-2xx responses, so returning 502 on transient
 * failures gives automatic retry for free.
 */
export const POST = withErrorCapture("/api/webhooks/resend", async (request: NextRequest) => {
  // Rate limit: 20 requests per IP per 60 seconds
  const ip = getClientIp(request);
  const rl = await rateLimit(`ratelimit:webhook:${ip}`, 20, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // 1. Read raw body BEFORE any JSON parsing (Svix needs exact bytes)
  const rawBody = await request.text();

  // 2. Extract and validate Svix headers
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing required Svix headers" },
      { status: 400 },
    );
  }

  // 3. Verify webhook signature
  const isValid = verifyWebhookSignature(rawBody, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  });

  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  // 4. Parse payload and check event type
  let payload: { type: string; data: { email_id?: string } };
  try {
    payload = JSON.parse(rawBody) as {
      type: string;
      data: { email_id?: string };
    };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  if (payload.type !== "email.received") {
    return NextResponse.json({ status: "ignored", type: payload.type });
  }

  const emailId = payload.data.email_id;
  if (!emailId) {
    return NextResponse.json(
      { error: "Missing email_id in payload" },
      { status: 400 },
    );
  }
  if (!EMAIL_ID_RE.test(emailId)) {
    return NextResponse.json(
      { error: "Invalid email_id format" },
      { status: 400 },
    );
  }

  // BE-L2: Dedup using cacheSetNxStatus so we can distinguish "already
  // processed" from "Redis unavailable". The three outcomes are:
  //
  //   "acquired"    — key newly written; this is the first delivery. Process it.
  //   "exists"      — key already present; Resend is retrying a delivery we
  //                   already handled. Return early to avoid duplicate forwarding.
  //   "unavailable" — Redis is down. Chosen behaviour: skip-forward (process
  //                   the email). This is the safer default because:
  //                   - Failing to forward a support email is worse than a rare
  //                     duplicate forward during a Redis outage.
  //                   - Resend retries are bounded (not infinite), so even in a
  //                     prolonged outage the duplicate count is finite.
  //                   - The old cacheSetNx path already skip-forwarded on
  //                     unavailability, so this preserves existing behaviour
  //                     while making the intent explicit.
  const dedupeKey = `webhook:resend:svix:${svixId}`;
  const dedupeStatus = await cacheSetNxStatus(dedupeKey, DEDUPE_TTL_SECONDS);
  if (dedupeStatus === "exists") {
    return NextResponse.json({ status: "already_processed", id: svixId });
  }
  // "acquired" or "unavailable" → continue processing

  // 5. Fetch full email
  const email = await fetchReceivedEmail(emailId);
  if (!email) {
    // BE-H2: this 502 exists specifically so Resend retries the delivery.
    // The dedupe key must be released, or the retry short-circuits as
    // "already_processed" (200) instead of actually re-attempting — silently
    // dropping the email for the full 7-day TTL despite Resend reporting a
    // successful delivery.
    await cacheDel(dedupeKey);
    return NextResponse.json(
      { error: "Failed to fetch received email" },
      { status: 502 },
    );
  }

  // 6. Log warning for attachments (not forwarded in v1)
  if (email.attachments && email.attachments.length > 0) {
    log("warn", "[webhook] Email has attachments — not forwarded in v1", {
      route: "/api/webhooks/resend",
      count: email.attachments.length,
    });
  }

  // 7. Forward to Gmail
  const result = await forwardEmail({
    from: email.from,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (!result) {
    // BE-H2: same rationale as the fetch failure branch above — release the
    // dedupe key so a genuine Resend retry can actually re-attempt the
    // forward.
    await cacheDel(dedupeKey);
    return NextResponse.json(
      { error: "Failed to forward email" },
      { status: 502 },
    );
  }

  return NextResponse.json({ status: "forwarded", id: result.id });
});
