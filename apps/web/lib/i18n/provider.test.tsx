// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import { LanguageContext, LanguageProvider } from './provider';
import { es } from './dictionaries/es';
import type { Translations } from './types';

vi.mock('./set-locale-action', () => ({
  setLocaleAction: vi.fn(async () => {}),
}));

import { setLocaleAction } from './set-locale-action';

const originalLocation = window.location;

function TestConsumer() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return <div data-testid="no-ctx">no context</div>;
  return (
    <div>
      <span data-testid="locale">{ctx.locale}</span>
      <button onClick={() => ctx.setLocale('es')}>switch-es</button>
      <button onClick={() => ctx.setLocale('en')}>switch-en</button>
      <button onClick={() => ctx.setLocale('es', { navigate: false })}>
        sync-es
      </button>
    </div>
  );
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    document.cookie = 'chapa-locale=; Max-Age=0; path=/';
    window.history.replaceState({}, '', '/');
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

  it('hydrates the persisted cookie on a route that does not mount LocaleSync', async () => {
    document.cookie = 'chapa-locale=en; path=/';
    window.history.replaceState({}, '', '/studio?lang=es');

    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <TestConsumer />
      </LanguageProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('locale').textContent).toBe('en')
    );
  });

  it('persists the locale and reloads the canonical route when the locale changes', async () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/',
        search: '',
        hash: '',
        assign,
      },
    });

    render(
      <LanguageProvider initialLocale="en">
        <TestConsumer />
      </LanguageProvider>
    );

    await act(async () => {
      screen.getByText('switch-es').click();
    });

    expect(setLocaleAction).toHaveBeenCalledWith('es');
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('applies an explicit locale before a slow cookie persistence call finishes', async () => {
    let finishPersistence: (() => void) | undefined;
    vi.mocked(setLocaleAction).mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishPersistence = resolve;
      })
    );

    render(
      <LanguageProvider initialLocale="en">
        <TestConsumer />
      </LanguageProvider>
    );

    screen.getByText('sync-es').click();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('locale').textContent).toBe('es');
    finishPersistence?.();
  });

  it('reloads through the canonical public path after switching from an internal locale route', async () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/es',
        search: '?source=release&lang=es',
        hash: '#features',
        assign,
      },
    });

    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <TestConsumer />
      </LanguageProvider>
    );

    await act(async () => {
      screen.getByText('switch-en').click();
    });

    expect(setLocaleAction).toHaveBeenCalledWith('en');
    expect(assign).toHaveBeenCalledWith('/?source=release&lang=en#features');
  });

  it('is a no-op when setLocale is called with the same locale', async () => {
    render(
      <LanguageProvider initialLocale="en">
        <TestConsumer />
      </LanguageProvider>
    );

    await act(async () => {
      screen.getByText('switch-en').click();
    });

    expect(setLocaleAction).not.toHaveBeenCalled();
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
