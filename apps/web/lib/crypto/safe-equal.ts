/**
 * Timing-safe string comparison for bearer tokens and secrets.
 * Wraps Node.js crypto.timingSafeEqual with length-mismatch handling.
 */

import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for bearer tokens and secrets.
 *
 * Wraps `crypto.timingSafeEqual` with automatic UTF-8 encoding and
 * length-mismatch short-circuit. Prevents timing side-channel attacks
 * when comparing user-supplied tokens against stored secrets.
 *
 * @param a - First string (e.g. the incoming bearer token)
 * @param b - Second string (e.g. the stored secret)
 * @returns `true` if the strings are identical; `false` otherwise (including on any error)
 */
export function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf-8");
    const bufB = Buffer.from(b, "utf-8");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
