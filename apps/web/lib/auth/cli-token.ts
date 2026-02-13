/**
 * CLI token generation and verification.
 *
 * CLI tokens are HMAC-SHA256 signed payloads used to authenticate
 * the CLI against the Chapa API without requiring a GitHub PAT.
 *
 * Format: base64url(payload).base64url(hmac_sha256(payload_encoded, secret))
 */

import { createHmac, timingSafeEqual } from "crypto";

interface CliTokenPayload {
  handle: string;
  type: "cli";
  iat: number;
  exp: number;
}

const TOKEN_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

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
 * Detect whether a Bearer token is a Chapa CLI token (has a `.` separator)
 * vs a GitHub PAT (starts with ghp_ / gho_ / ghu_ or has no dot).
 */
export function isCliToken(token: string): boolean {
  return token.includes(".");
}
