// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { useContext } from 'react';
import { LocaleSync } from './locale-sync';
import { LanguageContext, LanguageProvider } from './provider';
import { en } from './dictionaries/en';
import { es } from './dictionaries/es';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

// Mock the server action so no real cookie-write/revalidatePath happens in tests.
vi.mock('./set-locale-action', () => ({
  setLocaleAction: vi.fn().mockResolvedValue(undefined),
}));

import { setLocaleAction } from './set-locale-action';

/** Renders the currently-active translated hero title so we can assert the
 * visible translated text (not just that some function was invoked).
 * `landing.hero.title` has distinct English/Spanish strings in the real
 * dictionaries. */
function TranslatedTitle() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return <div data-testid="no-ctx">no context</div>;
  return <span data-testid="title">{ctx.t('landing.hero.title') as string}</span>;
}

describe('LocaleSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders null (no DOM output)', () => {
    const { container } = render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <LocaleSync />
      </LanguageProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls setLocaleAction (via the provider) when queryLang is a valid locale (en)', async () => {
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <LocaleSync queryLang="en" />
      </LanguageProvider>
    );
    await waitFor(() => expect(setLocaleAction).toHaveBeenCalledWith('en'));
  });

  it('calls setLocaleAction (via the provider) when queryLang is a valid locale (es)', async () => {
    render(
      <LanguageProvider initialLocale="en" dictionary={en}>
        <LocaleSync queryLang="es" />
      </LanguageProvider>
    );
    await waitFor(() => expect(setLocaleAction).toHaveBeenCalledWith('es'));
  });

  it('does NOT call setLocaleAction when queryLang is undefined', () => {
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <LocaleSync queryLang={undefined} />
      </LanguageProvider>
    );
    expect(setLocaleAction).not.toHaveBeenCalled();
  });

  it('does NOT call setLocaleAction when queryLang is null', () => {
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <LocaleSync queryLang={null} />
      </LanguageProvider>
    );
    expect(setLocaleAction).not.toHaveBeenCalled();
  });

  it('does NOT call setLocaleAction when queryLang is an unsupported locale', () => {
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <LocaleSync queryLang="fr" />
      </LanguageProvider>
    );
    expect(setLocaleAction).not.toHaveBeenCalled();
  });

  it('does NOT call setLocaleAction when queryLang is an empty string', () => {
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <LocaleSync queryLang="" />
      </LanguageProvider>
    );
    expect(setLocaleAction).not.toHaveBeenCalled();
  });

  it('does NOT call setLocaleAction when queryLang already matches the active locale (idempotent guard)', () => {
    render(
      <LanguageProvider initialLocale="en" dictionary={en}>
        <LocaleSync queryLang="en" />
      </LanguageProvider>
    );
    expect(setLocaleAction).not.toHaveBeenCalled();
  });

  describe('live locale application (#1020 regression)', () => {
    it('switches the rendered translated text on the SAME page load when ?lang= differs from the active locale', async () => {
      const { getByTestId } = render(
        <LanguageProvider initialLocale="es" dictionary={es}>
          <LocaleSync queryLang="en" />
          <TranslatedTitle />
        </LanguageProvider>
      );

      // Before the fix, LocaleSync only persisted the cookie for a FUTURE load —
      // the current render stayed in Spanish and never showed English text.
      expect(getByTestId('title').textContent).toBe('Impacto de desarrollador,');

      await waitFor(() =>
        expect(getByTestId('title').textContent).toBe('Developer impact,')
      );
    });

    it('switches from English to Spanish live when ?lang=es is present', async () => {
      const { getByTestId } = render(
        <LanguageProvider initialLocale="en" dictionary={en}>
          <LocaleSync queryLang="es" />
          <TranslatedTitle />
        </LanguageProvider>
      );

      expect(getByTestId('title').textContent).toBe('Developer impact,');

      await waitFor(() =>
        expect(getByTestId('title').textContent).toBe('Impacto de desarrollador,')
      );
    });
  });
});
