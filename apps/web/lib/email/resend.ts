/**
 * Resend email integration — inbound webhook handling and forwarding.
 *
 * Handles the flow:
 *   1. Verify Svix webhook signature from Resend
 *   2. Fetch the full received email via Resend API
 *   3. Forward it to the configured Gmail address via Resend send API
 *
 * Lazy singleton pattern matches lib/cache/redis.ts.
 */

import { Resend } from "resend";
import { Webhook } from "svix";

// ---------------------------------------------------------------------------
// HTML escaping for email templates
// ---------------------------------------------------------------------------

/** Escape HTML entities in user-controlled strings before embedding in HTML. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// HTML sanitization for forwarded email bodies
// ---------------------------------------------------------------------------

/**
 * Strip dangerous HTML constructs from an email body before forwarding.
 * Removes `<script>` blocks, inline event handlers (onclick, onerror, ...),
 * and `javascript:` URLs in href attributes.
 *
 * This is a defense-in-depth measure — the forwarded email is rendered in
 * a mail client, but we still strip known XSS vectors to be safe.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
}

// ---------------------------------------------------------------------------
// Lazy singleton
// ---------------------------------------------------------------------------

let _resend: Resend | null | undefined;

export function getResend(): Resend | null {
  if (_resend !== undefined) return _resend;

  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY is missing — email disabled");
    _resend = null;
    return null;
  }

  _resend = new Resend(apiKey);
  return _resend;
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verify a Resend webhook signature using the Svix library.
 * Returns true if valid, false otherwise.
 */
export function verifyWebhookSignature(
  rawBody: string,
  headers: Record<string, string>,
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();

  if (!secret) {
    console.warn(
      "[email] RESEND_WEBHOOK_SECRET is missing — cannot verify webhook",
    );
    return false;
  }

  try {
    const wh = new Webhook(secret);
    wh.verify(rawBody, headers);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Fetch received email
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ReceivedEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments: unknown[];
}

/**
 * Fetch a received email from Resend by ID.
 * Uses raw fetch because the Resend SDK doesn't expose a "get received email" method.
 */
export async function fetchReceivedEmail(
  emailId: string,
): Promise<ReceivedEmail | null> {
  // Validate UUID to prevent path injection
  if (!UUID_RE.test(emailId)) {
    console.warn("[email] Invalid email ID format:", emailId);
    return null;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY is missing — cannot fetch email");
    return null;
  }

  try {
    const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      console.error(
        "[email] Failed to fetch email:",
        res.status,
        await res.text(),
      );
      return null;
    }

    return (await res.json()) as ReceivedEmail;
  } catch (error) {
    console.error(
      "[email] fetchReceivedEmail error:",
      (error as Error).message,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Forward email
// ---------------------------------------------------------------------------

interface ForwardParams {
  from: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Forward a received email to the configured Gmail address.
 * Sets reply_to to the original sender so replies go directly to them.
 */
export async function forwardEmail(
  params: ForwardParams,
): Promise<{ id: string } | null> {
  const resend = getResend();
  if (!resend) return null;

  const forwardTo = process.env.SUPPORT_FORWARD_EMAIL?.trim();
  if (!forwardTo) {
    console.warn(
      "[email] SUPPORT_FORWARD_EMAIL is missing — cannot forward email",
    );
    return null;
  }

  // Escape user-controlled metadata fields to prevent XSS in HTML email
  const safeFrom = escapeHtml(params.from);
  const safeSubject = escapeHtml(params.subject);

  const forwardedHtml = [
    `<div style="padding:12px 0;margin-bottom:16px;border-bottom:1px solid #ccc;color:#666;font-size:13px;">`,
    `<strong>--- Forwarded message ---</strong><br/>`,
    `From: ${safeFrom}<br/>`,
    `Subject: ${safeSubject}`,
    `</div>`,
    sanitizeHtml(params.html),
  ].join("\n");

  const forwardedText = [
    "--- Forwarded message ---",
    `From: ${params.from}`,
    `Subject: ${params.subject}`,
    "",
    params.text,
  ].join("\n");

  try {
    const { data, error } = await resend.emails.send({
      from: "Chapa Support <support@chapa.thecreativetoken.com>",
      to: [forwardTo],
      replyTo: params.from,
      subject: `Fwd: ${params.subject}`,
      html: forwardedHtml,
      text: forwardedText,
    });

    if (error || !data) {
      console.error("[email] Forward failed:", error);
      return null;
    }

    return { id: data.id };
  } catch (error) {
    console.error("[email] forwardEmail error:", (error as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Test helper — reset the cached client (only used by tests)
// ---------------------------------------------------------------------------

/** @internal — exported for tests only. Resets the lazy singleton. */
export function _resetClient(): void {
  _resend = undefined;
}
