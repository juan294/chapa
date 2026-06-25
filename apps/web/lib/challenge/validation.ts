export const MAX_CHALLENGE_BYTES = 4 * 1024;
export const MIN_CHALLENGE_REASON_LENGTH = 20;
export const MAX_CHALLENGE_REASON_LENGTH = 1000;

export function isChallengeBody(value: unknown): value is {
  handle?: unknown;
  reason?: unknown;
} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
