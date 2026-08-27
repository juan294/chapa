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
import { __setFallbackDictionary } from "@/lib/i18n/fallback-dictionary";
import { en } from "@/lib/i18n/dictionaries/en";

// #1164 (FE-H1/PE-H1) — `useTranslation()`'s no-provider fallback used to
// resolve against a dictionary statically imported IN APPLICATION CODE,
// which pulled the English dictionary into every client bundle regardless of
// locale (it was referenced from the prerendered Spanish page too). The
// fallback exists only for tests that render a component outside
// LanguageProvider without asserting real translated copy — no production
// path renders outside the provider (docs/accepted-risks.md) — so the
// dictionary is injected here, at test setup, instead. This keeps ~463
// existing component tests (across ~49 files) that rely on that fallback
// resolving real English strings passing unchanged, while removing the
// static import from the shipped client bundle.
//
// Imported from `lib/i18n/fallback-dictionary.ts` specifically — NOT from
// `lib/i18n/use-translation.ts` — because that module imports `provider.tsx`,
// which imports `./set-locale-action`. A global setup file's imports run
// before a test file's own `vi.mock('./set-locale-action', ...)` is hoisted,
// so importing through `use-translation.ts` here registered the REAL
// `set-locale-action` module first and silently broke that mock everywhere
// it's used (`provider.test.tsx`'s `setLocaleAction` assertions saw zero
// calls). `fallback-dictionary.ts` has no path to `provider.tsx`, so it
// can't collide with any test file's mocks.
__setFallbackDictionary(en);

const SUPPRESSED_PREFIXES = [
  "[cache]",
  "[db]",
  "[email]",
  "[history]",
  "[verification]",
];

/**
 * jsdom emits "Not implemented" notices through its VirtualConsole, which
 * forwards to console.error, whenever a test exercises an unsupported browser
 * API (e.g. window.location navigation or window.scrollTo). These are
 * expected in component tests that trigger navigation traps and are pure
 * noise — they are not real test failures. Match them narrowly so genuine
 * "Not implemented" application errors are NOT swallowed: jsdom prefixes its
 * messages with the literal "Not implemented:" string (optionally wrapped in
 * an "Error:" prefix) and the offending API name.
 */
const JSDOM_NOISE_PATTERNS = [
  /Not implemented: navigation/,
  /Not implemented: window\.scrollTo/,
  /Not implemented: HTMLCanvasElement/,
];

function isJsdomNoise(value: unknown): boolean {
  const text =
    typeof value === "string"
      ? value
      : value instanceof Error
        ? value.message
        : "";
  return JSDOM_NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

function shouldSuppress(args: unknown[]): boolean {
  const first = args[0];
  if (typeof first === "string" && SUPPRESSED_PREFIXES.some((prefix) => first.startsWith(prefix))) {
    return true;
  }
  // jsdom navigation/scroll notices arrive as console.error(messageString, errorObject).
  // Suppress only when the message itself is a recognized jsdom "Not implemented" notice.
  return args.some((arg) => isJsdomNoise(arg));
}

// jsdom forwards its "Not implemented" notices through a VirtualConsole that
// was wired to the worker's console reference at environment-construction time
// — before setupFiles run — so swapping console.error in beforeAll() cannot
// intercept them. They land directly on process.stderr. Filter them at that
// final sink, matching ONLY the recognized jsdom noise patterns so genuine
// stderr output (real errors, test failures) is never hidden.
const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = ((
  chunk: string | Uint8Array,
  ...rest: unknown[]
): boolean => {
  if (typeof chunk === "string" && isJsdomNoise(chunk)) {
    // Swallow the jsdom notice; honor any write callback so callers don't hang.
    const cb = rest.find((arg) => typeof arg === "function") as
      | ((err?: Error | null) => void)
      | undefined;
    cb?.();
    return true;
  }
  return (originalStderrWrite as (...args: unknown[]) => boolean)(chunk, ...rest);
}) as typeof process.stderr.write;

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
