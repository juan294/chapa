import type { LanguageContextValue } from './provider';

type TFunction = LanguageContextValue['t'];

// `t()` is loosely typed (string | string[] | Record<string, unknown>[]) and,
// at runtime, also returns a plain object subtree for intermediate keys. These
// helpers centralize the otherwise-scattered `as unknown as` casts into one
// place and add a lightweight structural sanity check. Matching the codebase's
// graceful i18n style (resolveTranslation returns the key on miss; useTranslation
// warns rather than throws), a shape mismatch warns and returns a safe empty
// value instead of throwing — callers that render `.map()` degrade to empty
// rather than crashing.

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
