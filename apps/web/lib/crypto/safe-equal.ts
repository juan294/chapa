/**
 * Timing-safe string comparison for bearer tokens and secrets.
 * Wraps Node.js crypto.timingSafeEqual with length-mismatch handling.
 */

import { timingSafeEqual } from "node:crypto";

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
