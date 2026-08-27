// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LanguageProvider } from './provider';
import { useTranslation, __setFallbackDictionary } from './use-translation';
import { es } from './dictionaries/es';
import { en } from './dictionaries/en';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

vi.mock('./set-locale-action', () => ({
  setLocaleAction: vi.fn(async () => {}),
}));

function ConsumerInside() {
  const { locale, t } = useTranslation();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="title">{t('meta.defaultTitle') as string}</span>
    </div>
  );
}

function ConsumerOutside() {
  const { locale, t } = useTranslation();
  return (
    <div>
      <span data-testid="locale-outside">{locale}</span>
      <span data-testid="title-outside">{t('meta.defaultTitle') as string}</span>
    </div>
  );
}

describe('useTranslation inside LanguageProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns context locale and t function', () => {
    // Production passes the active locale's dictionary as a prop (the server
    // resolves it). Mirror that here so the Spanish dictionary is available.
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <ConsumerInside />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(screen.getByTestId('title').textContent).toBe(
      'Chapa — Impacto de desarrollador, decodificado'
    );
  });

  it('resolves English translations when locale is en', () => {
    // #1164 — the provider no longer falls back to a statically-imported
    // English dictionary, so tests must supply it explicitly (production
    // always does, via the RSC payload).
    render(
      <LanguageProvider initialLocale="en" dictionary={en}>
        <ConsumerInside />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('title').textContent).toBe(
      'Chapa — Developer Impact, Decoded'
    );
  });
});

describe('useTranslation outside LanguageProvider (fallback)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    cleanup();
  });

  it('warns once and returns en fallback locale', () => {
    render(<ConsumerOutside />);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('LanguageProvider not found');
    expect(screen.getByTestId('locale-outside').textContent).toBe('en');
  });

  // #1164 (FE-H1/PE-H1) — this fallback used to resolve against a
  // statically-imported English dictionary, which pulled the ~90KB English
  // dictionary chunk into every client bundle regardless of locale (it was
  // referenced from the prerendered SPANISH page too — 17 <script src> refs
  // in es.html). The dictionary is now injected at test setup
  // (`vitest.setup.ts` calls `__setFallbackDictionary(en)`) instead of
  // imported by this application module, so the ~463 existing component
  // tests that rely on this fallback resolving real English copy keep
  // passing unchanged.
  it('fallback t("meta.defaultTitle") resolves real English text via the test-injected dictionary', () => {
    render(<ConsumerOutside />);

    expect(screen.getByTestId('title-outside').textContent).toBe(
      'Chapa — Developer Impact, Decoded'
    );
  });

  // Guard test: prove the safety net independently of the global test-setup
  // injection above. Production never calls `__setFallbackDictionary`, so
  // `fallbackDictionary` is `undefined` there — this must never crash or
  // render literal `undefined`, only degrade to the raw key.
  it('degrades to the raw key (never crashes, never renders "undefined") when no dictionary is injected', () => {
    __setFallbackDictionary(undefined);
    try {
      render(<ConsumerOutside />);
      const text = screen.getByTestId('title-outside').textContent;
      expect(text).toBe('meta.defaultTitle');
      expect(text).not.toBe('undefined');
      expect(text).not.toBe('');
    } finally {
      // Restore the test-suite-wide injection for any later test in this file.
      __setFallbackDictionary(en);
    }
  });
});
