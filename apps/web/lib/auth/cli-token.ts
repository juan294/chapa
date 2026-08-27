/**
 * CLI token generation and verification.
 *
 * CLI tokens are HMAC-SHA256 signed payloads used to authenticate
 * the CLI against the Chapa API without requiring a GitHub PAT.
 *
 * Format: base64url(payload).base64url(hmac_sha256(payload_encoded, secret))
 */

import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

interface CliTokenPayload {
  handle: string;
  type: "cli";
  iat: number;
  exp: number;
}

// SE-H1 interim mitigation (#1174): shortened from 90 days to 10 days.
// A token obtained via a phished /cli/authorize approval link (the gap
// tracked by #1174; the full device-code-on-approve binding is deferred to
// Wave 3) previously carried a 90-day, unrevocable grant. 10 days keeps
// normal CLI usage friction-free (most users re-authorize far more often
// than that in practice) while bounding the blast radius of any single
// leaked/phished token to a much shorter window. Regression note: this
// invalidates any CLI token issued before this change on its next use — the
// holder must re-run `chapa login`. That is intended.
const TOKEN_EXPIRY_MS = 10 * 24 * 60 * 60 * 1000; // 10 days

/**
 * Generate an HMAC-signed CLI authentication token for a user.
 *
 * The token embeds the user's handle, a creation timestamp, and a 10-day
 * expiry (#1174). Format: `base64url(payload).base64url(hmac_sha256(payload, secret))`.
 * This allows CLI authentication without requiring a GitHub PAT.
 *
 * @param handle - The GitHub handle to embed in the token payload
 * @param secret - The HMAC signing secret (typically `NEXTAUTH_SECRET`)
 * @returns A dot-separated signed token string
 */
export function generateCliToken(handle: string, secret: string): string {
  const payload: CliTokenPayload = {
    handle,
    type: "cli",
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

/**
 * Verify and decode a CLI authentication token.
 *
 * Validates the HMAC signature using timing-safe comparison, checks the
 * token type is `"cli"`, and verifies the token has not expired.
 * Returns the embedded handle on success, or `null` on any validation failure.
 *
 * @param token - The dot-separated signed token to verify
 * @param secret - The HMAC signing secret (must match the one used to generate)
 * @returns An object with the `handle` on success, or `null` if invalid/expired
 */
export function verifyCliToken(
  token: string,
  secret: string,
): { handle: string } | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;

  const encoded = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);

  const expectedSig = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload: CliTokenPayload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    );
    if (payload.type !== "cli") return null;
    if (payload.exp < Date.now()) return null;
    return { handle: payload.handle };
  } catch {
    return null;
  }
}

/**
 * Detect whether a Bearer token is a Chapa CLI token
 * (exactly one dot, both parts non-empty and base64url-safe)
 * vs a GitHub PAT (starts with ghp_ / gho_ / ghu_ or has no dot).
 */
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export function isCliToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!payload || !sig) return false;
  return BASE64URL_RE.test(payload) && BASE64URL_RE.test(sig);
}

/**
 * CLI device-authorization context (SE-H1 interim mitigation, #1174).
 *
 * Captures the IP and user-agent of the device that INITIATED a CLI device
 * authorization session — i.e. the first `/api/cli/auth/poll` call that
 * creates the session. Surfaced on the `/cli/authorize` approval page so a
 * user approving a request has a visible signal for whether it matches the
 * device/browser they expect. This is a UX/awareness signal against a
 * phished approval link, not a binding enforcement mechanism — the full
 * device-code-on-approve binding is deferred to Wave 3 (blocked on the
 * external CLI shipping a user code first).
 */
export interface CliDeviceContext {
  ip: string;
  userAgent: string;
}

/** Caps a device-context field's stored/rendered length. */
const CLI_DEVICE_CONTEXT_FIELD_MAX_LEN = 200;

/** Redis key for the device context captured at CLI device-session creation. */
export function cliDeviceContextKey(sessionId: string): string {
  return `cli:device-context:${sessionId}`;
}

/**
 * Bound and default a device-context field pulled from a request header.
 *
 * The user-agent header in particular is attacker-influenceable free text
 * sent by whichever client makes the first poll — cap its length so a
 * hostile value can't bloat Redis storage or the rendered approval page.
 * React escapes it as plain text on render, so no HTML/script injection is
 * possible even from an adversarial value.
 */
export function sanitizeDeviceContextField(
  value: string | null | undefined,
): string {
  const trimmed = value?.trim();
  if (!trimmed) return "unknown";
  return trimmed.slice(0, CLI_DEVICE_CONTEXT_FIELD_MAX_LEN);
}
