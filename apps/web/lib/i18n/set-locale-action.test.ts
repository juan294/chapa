import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('./cookie', () => ({
  writeLocaleCookie: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import { writeLocaleCookie } from './cookie';
import { setLocaleAction } from './set-locale-action';

describe('setLocaleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes valid locale "es" without invalidating static routes', async () => {
    await setLocaleAction('es');
    expect(writeLocaleCookie).toHaveBeenCalledWith('es');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('writes valid locale "en" without invalidating static routes', async () => {
    await setLocaleAction('en');
    expect(writeLocaleCookie).toHaveBeenCalledWith('en');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('does NOT call writeLocaleCookie for invalid locale "fr"', async () => {
    // Cast to bypass TypeScript — testing runtime guard
    await setLocaleAction('fr' as never);
    expect(writeLocaleCookie).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
