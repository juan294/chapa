import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('./cookie', () => ({
  readLocaleCookie: vi.fn(),
}));

import { headers } from 'next/headers';
import { readLocaleCookie } from './cookie';
import { getServerLocale, getServerT } from './server';

describe('getServerLocale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns "es" when query override is "es"', async () => {
    expect(await getServerLocale('es')).toBe('es');
  });

  it('returns "en" when query override is "en"', async () => {
    expect(await getServerLocale('en')).toBe('en');
  });

  it('falls through to cookie when query override is unknown "fr"', async () => {
    vi.mocked(readLocaleCookie).mockResolvedValue('en');
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn().mockReturnValue(null),
    } as unknown as Awaited<ReturnType<typeof headers>>);

    expect(await getServerLocale('fr')).toBe('en');
    expect(readLocaleCookie).toHaveBeenCalled();
  });

  it('cookie "es" wins over Accept-Language header', async () => {
    vi.mocked(readLocaleCookie).mockResolvedValue('es');
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn().mockReturnValue('en'),
    } as unknown as Awaited<ReturnType<typeof headers>>);

    expect(await getServerLocale()).toBe('es');
  });

  it('uses Accept-Language when no cookie is set', async () => {
    vi.mocked(readLocaleCookie).mockResolvedValue(null);
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn().mockReturnValue('es-ES,es;q=0.9,en;q=0.8'),
    } as unknown as Awaited<ReturnType<typeof headers>>);

    expect(await getServerLocale()).toBe('es');
  });

  it('defaults to "es" when no cookie and no relevant Accept-Language', async () => {
    vi.mocked(readLocaleCookie).mockResolvedValue(null);
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn().mockReturnValue(null),
    } as unknown as Awaited<ReturnType<typeof headers>>);

    expect(await getServerLocale()).toBe('es');
  });
});

describe('getServerT', () => {
  it('resolves meta.defaultTitle for en', () => {
    const t = getServerT('en');
    expect(t('meta.defaultTitle')).toBe('Chapa — Developer Impact, Decoded');
  });

  it('resolves meta.defaultTitle for es', () => {
    const t = getServerT('es');
    expect(t('meta.defaultTitle')).toBe('Chapa — Impacto de desarrollador, decodificado');
  });

  it('returns the key when a translation is missing', () => {
    const t = getServerT('en');
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });
});
