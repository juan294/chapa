/**
 * Vitest global setup — suppress expected stderr noise from graceful
 * degradation paths (cache, db, email modules log warnings/errors when
 * their backing services are unavailable, which is expected in tests).
 */
import { beforeAll, afterAll, vi } from "vitest";

const SUPPRESSED_PREFIXES = [
  "[cache]",
  "[db]",
  "[email]",
  "[history]",
  "[verification]",
];

function shouldSuppress(args: unknown[]): boolean {
  const first = args[0];
  if (typeof first !== "string") return false;
  return SUPPRESSED_PREFIXES.some((prefix) => first.startsWith(prefix));
}

let originalWarn: typeof console.warn;
let originalError: typeof console.error;

beforeAll(() => {
  originalWarn = console.warn;
  originalError = console.error;

  console.warn = (...args: unknown[]) => {
    if (!shouldSuppress(args)) {
      originalWarn.apply(console, args);
    }
  };

  console.error = (...args: unknown[]) => {
    if (!shouldSuppress(args)) {
      originalError.apply(console, args);
    }
  };
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});
