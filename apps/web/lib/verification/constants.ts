export const CURRENT_VERIFICATION_HASH_HEX_LENGTH = 32;
export const VERIFICATION_HASH_PATTERN =
  /^(?:[0-9a-f]{8}|[0-9a-f]{16}|[0-9a-f]{32})$/;
export const VERIFICATION_RECORD_TTL_DAYS = 30;

/** Versioned tokens bind a full HMAC to an immutable receipt revision. */
export const VERIFICATION_V7_PATTERN = /^v7\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([0-9a-f]{64})$/;
export const VERIFICATION_CODE_MAX_LENGTH = 104;
export const VERIFICATION_CODE_PATTERN = /^(?:[0-9a-f]{8}|[0-9a-f]{16}|[0-9a-f]{32}|v7\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[0-9a-f]{64})$/;
export const VERIFICATION_V7_KEY_VERSION = "v7-1";
export function parseVerificationTokenV7(token: string): { revisionId: string; signature: string } | null {
  const match = VERIFICATION_V7_PATTERN.exec(token);
  return match ? { revisionId: match[1]!, signature: match[2]! } : null;
}
