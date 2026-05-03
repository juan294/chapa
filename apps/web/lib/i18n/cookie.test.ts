import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { cookies } from 'next/headers';
import { readLocaleCookie, writeLocaleCookie } from './cookie';

describe('readLocaleCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns "en" when cookie value is "en"', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'en' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    expect(await readLocaleCookie()).toBe('en');
  });

  it('returns "es" when cookie value is "es"', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'es' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    expect(await readLocaleCookie()).toBe('es');
  });

  it('returns null when cookie value is an unsupported locale "fr"', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'fr' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    expect(await readLocaleCookie()).toBeNull();
  });

  it('returns null when cookie is missing', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    expect(await readLocaleCookie()).toBeNull();
  });
});

describe('writeLocaleCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls store.set with the correct args for "en" including httpOnly: false', async () => {
    const mockSet = vi.fn();
    vi.mocked(cookies).mockResolvedValue({
      set: mockSet,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    await writeLocaleCookie('en');

    expect(mockSet).toHaveBeenCalledWith('chapa-locale', 'en', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      secure: false,
      httpOnly: false,
    });
  });

  it('calls store.set with "es" locale', async () => {
    const mockSet = vi.fn();
    vi.mocked(cookies).mockResolvedValue({
      set: mockSet,
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    await writeLocaleCookie('es');

    expect(mockSet).toHaveBeenCalledWith('chapa-locale', 'es', expect.objectContaining({
      httpOnly: false,
    }));
  });
});
