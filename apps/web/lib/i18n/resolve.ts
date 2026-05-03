import type { Translations } from './types';

type TranslationLeaf = string | string[] | string[][] | Translations | Translations[];

export function resolveTranslation(
  key: string,
  translations: Translations
): TranslationLeaf {
  const parts = key.split('.');
  let current: Translations[string] = translations;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return key;
    }
    const next: Translations[string] | undefined = (current as Translations)[part];
    if (next === undefined) return key;
    current = next;
  }

  // Leaf must be a string, string[], or Translations[]
  if (typeof current === 'string') return current;
  if (Array.isArray(current)) return current as string[] | string[][] | Translations[];

  // Intermediate object — return the sub-tree so callers can cast as needed
  return current as Translations;
}
