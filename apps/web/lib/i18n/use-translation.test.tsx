// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LanguageProvider } from './provider';
import { useTranslation } from './use-translation';

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
    render(
      <LanguageProvider initialLocale="es">
        <ConsumerInside />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(screen.getByTestId('title').textContent).toBe(
      'Chapa — Impacto de desarrollador, decodificado'
    );
  });

  it('resolves English translations when locale is en', () => {
    render(
      <LanguageProvider initialLocale="en">
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

  it('fallback t("meta.defaultTitle") returns the English string', () => {
    render(<ConsumerOutside />);

    expect(screen.getByTestId('title-outside').textContent).toBe(
      'Chapa — Developer Impact, Decoded'
    );
  });
});
