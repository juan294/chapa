import { describe, it, expect } from 'vitest';
import { resolveTranslation } from './resolve';
import type { Translations } from './types';

describe('resolveTranslation', () => {
  it('returns a leaf string when key matches', () => {
    const t: Translations = { a: { b: 'hello' } };
    expect(resolveTranslation('a.b', t)).toBe('hello');
  });

  it('returns a leaf string array when key matches an array of strings', () => {
    const t: Translations = { a: { bullets: ['x', 'y'] } };
    expect(resolveTranslation('a.bullets', t)).toEqual(['x', 'y']);
  });

  it('returns the key itself when a segment is missing', () => {
    const t: Translations = { a: {} };
    expect(resolveTranslation('a.missing', t)).toBe('a.missing');
  });

  it('returns the sub-tree when key resolves to an intermediate object', () => {
    const tree: Translations = { a: { b: 'c' } };
    expect(resolveTranslation('a', tree)).toEqual({ b: 'c' });
  });

  it('resolves a deeply nested key', () => {
    const t: Translations = { a: { b: { c: { d: 'deep' } } } };
    expect(resolveTranslation('a.b.c.d', t)).toBe('deep');
  });

  it('returns empty string when the leaf is an empty string', () => {
    const t: Translations = { a: { empty: '' } };
    expect(resolveTranslation('a.empty', t)).toBe('');
  });

  it('returns an array of Translations when the leaf is a Translations array', () => {
    const items: Translations[] = [{ title: 'first' }, { title: 'second' }];
    const t: Translations = { a: { list: items } };
    expect(resolveTranslation('a.list', t)).toEqual(items);
  });

  it('returns the key when traversal hits a non-object in the middle', () => {
    const t: Translations = { a: 'scalar' };
    // 'a.b' tries to descend into a string
    expect(resolveTranslation('a.b', t)).toBe('a.b');
  });
});
