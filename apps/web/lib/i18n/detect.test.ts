import { describe, it, expect } from 'vitest';
import { pickFromAcceptLanguage, pickFromNavigatorLanguages } from './detect';

describe('pickFromAcceptLanguage', () => {
  it('picks es from "es-ES,es;q=0.9,en;q=0.8"', () => {
    expect(pickFromAcceptLanguage('es-ES,es;q=0.9,en;q=0.8')).toBe('es');
  });

  it('picks en when no es match exists: "fr-FR,fr;q=0.9,en;q=0.5"', () => {
    expect(pickFromAcceptLanguage('fr-FR,fr;q=0.9,en;q=0.5')).toBe('en');
  });

  it('returns null when no supported language is found: "fr,de"', () => {
    expect(pickFromAcceptLanguage('fr,de')).toBeNull();
  });

  it('returns null for empty string header', () => {
    expect(pickFromAcceptLanguage('')).toBeNull();
  });

  it('returns null for null header', () => {
    expect(pickFromAcceptLanguage(null)).toBeNull();
  });

  it('treats malformed single token without q as quality 1.0 and picks primary if supported', () => {
    // "garbage" has no supported primary subtag
    expect(pickFromAcceptLanguage('garbage')).toBeNull();
  });

  it('picks en from "en-US"', () => {
    expect(pickFromAcceptLanguage('en-US')).toBe('en');
  });

  it('picks es from "es"', () => {
    expect(pickFromAcceptLanguage('es')).toBe('es');
  });

  it('treats q=0 as acceptable (lowest priority)', () => {
    // es;q=0, en;q=0.1 — en wins but both are valid, es comes last
    expect(pickFromAcceptLanguage('en;q=0.1,es;q=0')).toBe('en');
  });

  it('picks es from "es;q=0" when en is not present', () => {
    // Only es with q=0 — still valid, es is supported
    expect(pickFromAcceptLanguage('es;q=0')).toBe('es');
  });

  it('ignores malformed q value and treats the token as q=1.0', () => {
    // "es;q=abc" — parseFloat("abc") is NaN, so q stays at default 1.0
    expect(pickFromAcceptLanguage('es;q=abc')).toBe('es');
  });

  it('skips empty-lang tokens produced by leading commas', () => {
    // ",es" splits into ["", "es"] — empty token is filtered out, es is picked
    expect(pickFromAcceptLanguage(',es')).toBe('es');
  });
});

describe('pickFromNavigatorLanguages', () => {
  it('picks es from ["es-ES", "en-US"]', () => {
    expect(pickFromNavigatorLanguages(['es-ES', 'en-US'])).toBe('es');
  });

  it('returns null when no supported language is found: ["fr", "de"]', () => {
    expect(pickFromNavigatorLanguages(['fr', 'de'])).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(pickFromNavigatorLanguages([])).toBeNull();
  });

  it('picks en from ["en"]', () => {
    expect(pickFromNavigatorLanguages(['en'])).toBe('en');
  });

  it('picks en from ["en-GB", "es"]', () => {
    expect(pickFromNavigatorLanguages(['en-GB', 'es'])).toBe('en');
  });
});
