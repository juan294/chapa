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

  it('calls writeLocaleCookie and revalidatePath for valid locale "es"', async () => {
    await setLocaleAction('es');
    expect(writeLocaleCookie).toHaveBeenCalledWith('es');
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('calls writeLocaleCookie and revalidatePath for valid locale "en"', async () => {
    await setLocaleAction('en');
    expect(writeLocaleCookie).toHaveBeenCalledWith('en');
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('does NOT call writeLocaleCookie for invalid locale "fr"', async () => {
    // Cast to bypass TypeScript — testing runtime guard
    await setLocaleAction('fr' as never);
    expect(writeLocaleCookie).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
