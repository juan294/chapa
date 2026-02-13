import { NextResponse } from "next/server";

import {
  verifyWebhookSignature,
  fetchReceivedEmail,
  forwardEmail,
} from "@/lib/email/resend";
import { rateLimit } from "@/lib/cache/redis";

/**
 * POST /api/webhooks/resend
 *
 * Receives inbound email notifications from Resend via Svix webhook,
 * fetches the full email, and forwards it to the configured Gmail address.
 *
 * Resend retries on non-2xx responses, so returning 502 on transient
 * failures gives automatic retry for free.
 */
export async function POST(request: Request) {
  // Rate limit: 20 requests per IP per 60 seconds
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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
  const payload = JSON.parse(rawBody) as {
    type: string;
    data: { email_id?: string };
  };

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

  // 5. Fetch full email
  const email = await fetchReceivedEmail(emailId);
  if (!email) {
    return NextResponse.json(
      { error: "Failed to fetch received email" },
      { status: 502 },
    );
  }

  // 6. Log warning for attachments (not forwarded in v1)
  if (email.attachments && email.attachments.length > 0) {
    console.warn(
      `[webhook] Email has ${email.attachments.length} attachment(s) — not forwarded in v1`,
    );
  }

  // 7. Forward to Gmail
  const result = await forwardEmail({
    from: email.from,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (!result) {
    return NextResponse.json(
      { error: "Failed to forward email" },
      { status: 502 },
    );
  }

  return NextResponse.json({ status: "forwarded", id: result.id });
}
