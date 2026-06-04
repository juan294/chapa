/**
 * Vitest global setup — suppress expected stderr noise from graceful
 * degradation paths (cache, db, email modules log warnings/errors when
 * their backing services are unavailable, which is expected in tests).
 *
 * Also polyfills localStorage for Node.js 26+: the native Web Storage API
 * exposes `localStorage` as an undefined global until `--localstorage-file`
 * is provided, which prevents JSDOM from injecting its own implementation.
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

// Node.js 26 exposes localStorage as undefined without --localstorage-file.
// JSDOM normally provides its own implementation, but Node 26's non-enumerable
// descriptor prevents the vitest JSDOM environment from injecting it into the
// global. Polyfill it here so tests using window.localStorage / localStorage work.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    },
  });
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
