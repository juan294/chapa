import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setLocaleAction } from './set-locale-action';

describe('setLocaleAction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('POSTs valid locale "es" to /api/locale', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await setLocaleAction('es');

    expect(fetch).toHaveBeenCalledWith('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'es' }),
    });
  });

  it('POSTs valid locale "en" to /api/locale', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await setLocaleAction('en');

    expect(fetch).toHaveBeenCalledWith('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'en' }),
    });
  });

  it('does NOT fetch for invalid locale "fr"', async () => {
    // Cast to bypass TypeScript — testing runtime guard
    await setLocaleAction('fr' as never);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws when the persistence request fails, so the caller can mark persistence as failed', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));

    await expect(setLocaleAction('es')).rejects.toThrow();
  });
});
