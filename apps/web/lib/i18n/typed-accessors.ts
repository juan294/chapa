// Deliberately widened to `unknown`: callers pass either the client
// `useTranslation().t` (typed via `LanguageContextValue['t']`) or the server
// `getServerT(locale)` (typed via `resolveTranslation`'s broader
// `TranslationLeaf` union, per #1023's locale-segmented RSC content pages).
// Both are structurally compatible at the call site (a function taking a
// `string` key), but their declared return-type unions differ, so a shared
// `TFunction` alias has to be loose enough to accept either without an
// `as unknown as` cast at every call site. The runtime shape checks below are
// what actually guard correctness, not this type.
type TFunction = (key: string) => unknown;

// `t()` is loosely typed and, at runtime, also returns a plain object subtree
// for intermediate keys. These helpers centralize the otherwise-scattered
// `as unknown as` casts into one place and add a lightweight structural
// sanity check. Matching the codebase's graceful i18n style (resolveTranslation
// returns the key on miss; useTranslation warns rather than throws), a shape
// mismatch warns and returns a safe empty value instead of throwing — callers
// that render `.map()` degrade to empty rather than crashing.

export function tArray<T>(t: TFunction, key: string): T[] {
  const value = t(key);
  if (!Array.isArray(value)) {
    console.warn(
      `i18n: expected key "${key}" to resolve to an array, got ${typeof value}. Returning [].`
    );
    return [];
  }
  return value as unknown as T[];
}

export function tObject<T>(t: TFunction, key: string): T {
  const value = t(key);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    console.warn(
      `i18n: expected key "${key}" to resolve to an object, got ${
        Array.isArray(value) ? 'array' : typeof value
      }. Returning {}.`
    );
    return {} as T;
  }
  return value as unknown as T;
}
