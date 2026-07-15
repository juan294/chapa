import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { tArray, tObject } from './typed-accessors';
import { resolveTranslation } from './resolve';
import { en } from './dictionaries/en';
import type { LanguageContextValue } from './provider';

// Build a `t` that reads the real English dictionary, mirroring the runtime
// shape returned by useTranslation().t.
const t: LanguageContextValue['t'] = (key: string) =>
  resolveTranslation(key, en) as ReturnType<LanguageContextValue['t']>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tArray', () => {
  it('extracts a real structured array dictionary key', () => {
    const steps = tArray<{ number: string; title: string; description: string }>(
      t,
      'landing.steps'
    );
    expect(Array.isArray(steps)).toBe(true);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0]).toHaveProperty('number');
    expect(steps[0]).toHaveProperty('title');
  });

  it('extracts a nested array-of-arrays (table rows) key', () => {
    const rows = tArray<string[]>(t, 'about.scoring.capsTableRows');
    expect(Array.isArray(rows)).toBe(true);
    expect(Array.isArray(rows[0])).toBe(true);
  });

  it('warns and returns an empty array when the key does not resolve to an array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A leaf string key, not an array
    const result = tArray<{ label: string }>(t, 'landing.hero.title');
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('landing.hero.title');
  });

  it('warns and returns an empty array for a missing key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = tArray(t, 'landing.does.not.exist');
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('tObject', () => {
  it('extracts a real structured object subtree key', () => {
    const hero = tObject<Record<string, string | string[]>>(t, 'landing.hero');
    expect(typeof hero).toBe('object');
    expect(hero.title).toBe('Developer impact,');
  });

  it('warns and returns an empty object when the key resolves to an array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = tObject<Record<string, string>>(t, 'landing.steps');
    expect(result).toEqual({});
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('landing.steps');
  });

  it('warns and returns an empty object when the key resolves to a string', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = tObject<Record<string, string>>(t, 'landing.hero.title');
    expect(result).toEqual({});
    expect(warn).toHaveBeenCalledOnce();
  });
});

// #1026 (FE-M3) — regression guard: forbid unchecked `as string[]` / `as
// Array<...>` casts directly on a `t(...)` call result, which is exactly the
// pattern this file's tArray()/tObject() helpers exist to replace (an
// unchecked cast crashes .map() on a malformed/missing translation key,
// whereas tArray degrades gracefully). See apps/web/eslint.config.mjs for the
// enforcing no-restricted-syntax rule.
describe('eslint guard against unchecked t() casts (#1026)', () => {
  const source = readFileSync(new URL('../../eslint.config.mjs', import.meta.url), 'utf8');

  it('flags `t(...) as T[]` casts via a no-restricted-syntax selector', () => {
    expect(source).toContain(
      "TSAsExpression[expression.type='CallExpression'][expression.callee.name='t'][typeAnnotation.type='TSArrayType']"
    );
  });

  it('flags `t(...) as Array<T>` casts via a no-restricted-syntax selector', () => {
    expect(source).toContain(
      "TSAsExpression[expression.type='CallExpression'][expression.callee.name='t'][typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='Array']"
    );
  });

  it('excludes typed-accessors.ts and resolve.ts (the resolver internals, not caller casts)', () => {
    expect(source).toContain('lib/i18n/typed-accessors.ts');
    expect(source).toContain('lib/i18n/resolve.ts');
  });
});
