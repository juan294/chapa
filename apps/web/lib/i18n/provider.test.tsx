// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { useContext } from 'react';
import { LanguageContext, LanguageProvider } from './provider';
import { es } from './dictionaries/es';
import type { Translations } from './types';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

vi.mock('./set-locale-action', () => ({
  setLocaleAction: vi.fn(async () => {}),
}));

import { useRouter } from 'next/navigation';
import { setLocaleAction } from './set-locale-action';

function TestConsumer() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return <div data-testid="no-ctx">no context</div>;
  return (
    <div>
      <span data-testid="locale">{ctx.locale}</span>
      <button onClick={() => ctx.setLocale('es')}>switch-es</button>
      <button onClick={() => ctx.setLocale('en')}>switch-en</button>
    </div>
  );
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('provides the initial locale via context', () => {
    render(
      <LanguageProvider initialLocale="en">
        <TestConsumer />
      </LanguageProvider>
    );
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('provides "es" as initial locale when specified', () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );
    expect(screen.getByTestId('locale').textContent).toBe('es');
  });

  it('calls setLocaleAction and router.refresh when setLocale is called with a different locale', async () => {
    const mockRefresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ refresh: mockRefresh } as unknown as ReturnType<typeof useRouter>);

    render(
      <LanguageProvider initialLocale="en">
        <TestConsumer />
      </LanguageProvider>
    );

    await act(async () => {
      screen.getByText('switch-es').click();
    });

    expect(setLocaleAction).toHaveBeenCalledWith('es');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('is a no-op when setLocale is called with the same locale', async () => {
    const mockRefresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ refresh: mockRefresh } as unknown as ReturnType<typeof useRouter>);

    render(
      <LanguageProvider initialLocale="en">
        <TestConsumer />
      </LanguageProvider>
    );

    await act(async () => {
      screen.getByText('switch-en').click();
    });

    expect(setLocaleAction).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('context value is accessible via useContext(LanguageContext)', () => {
    render(
      <LanguageProvider initialLocale="es">
        <TestConsumer />
      </LanguageProvider>
    );
    expect(screen.getByTestId('locale').textContent).toBe('es');
  });

  describe('dictionary prop (#862 — ship active locale only)', () => {
    function TranslateConsumer() {
      const ctx = useContext(LanguageContext);
      if (!ctx) return <div data-testid="no-ctx">no context</div>;
      return <span data-testid="title">{ctx.t('meta.defaultTitle') as string}</span>;
    }

    it('resolves translations from the provided dictionary prop', () => {
      render(
        <LanguageProvider initialLocale="es" dictionary={es}>
          <TranslateConsumer />
        </LanguageProvider>
      );
      expect(screen.getByTestId('title').textContent).toBe(
        'Chapa — Impacto de desarrollador, decodificado'
      );
    });

    it('falls back to the bundled English dictionary when no dictionary prop is given', () => {
      // This is the test-only path; production always supplies the dictionary.
      render(
        <LanguageProvider initialLocale="es">
          <TranslateConsumer />
        </LanguageProvider>
      );
      expect(screen.getByTestId('title').textContent).toBe(
        'Chapa — Developer Impact, Decoded'
      );
    });

    it('uses whatever dictionary is passed regardless of locale label', () => {
      const custom: Translations = { meta: { defaultTitle: 'Custom Title' } };
      render(
        <LanguageProvider initialLocale="en" dictionary={custom}>
          <TranslateConsumer />
        </LanguageProvider>
      );
      expect(screen.getByTestId('title').textContent).toBe('Custom Title');
    });
  });
});
