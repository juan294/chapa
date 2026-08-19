// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import { useContext, useEffect } from 'react';
import { LanguageContext, LanguageProvider, type LanguageContextValue } from './provider';
import { es } from './dictionaries/es';
import type { Translations } from './types';

vi.mock('./set-locale-action', () => ({
  setLocaleAction: vi.fn(async () => {}),
}));

import { setLocaleAction } from './set-locale-action';

const originalLocation = window.location;

function stubLocation({
  pathname,
  search = '',
  hash = '',
}: {
  pathname: string;
  search?: string;
  hash?: string;
}) {
  const assign = vi.fn();
  const reload = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, pathname, search, hash, assign, reload },
  });
  return { assign, reload };
}

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

  it('keeps an explicit query locale authoritative before LocaleSync mounts', async () => {
    document.cookie = 'chapa-locale=en; path=/';
    window.history.replaceState({}, '', '/studio?lang=es');

    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <TestConsumer />
      </LanguageProvider>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('locale').textContent).toBe('es');
  });

  it('applies an explicit query locale on a route without LocaleSync', async () => {
    window.history.replaceState({}, '', '/verify?lang=en');

    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <TestConsumer />
      </LanguageProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('locale').textContent).toBe('en')
    );
  });

  it('persists the locale and explicitly reloads when the canonical route is unchanged', async () => {
    const { assign, reload } = stubLocation({ pathname: '/' });

    render(
      <LanguageProvider initialLocale="en">
        <TestConsumer />
      </LanguageProvider>
    );

    await act(async () => {
      screen.getByText('switch-es').click();
    });

    expect(setLocaleAction).toHaveBeenCalledWith('es');
    expect(reload).toHaveBeenCalledOnce();
    expect(assign).not.toHaveBeenCalled();
  });

  it('explicitly reloads when an unchanged skip-link fragment would make navigation a no-op', async () => {
    const { assign, reload } = stubLocation({
      pathname: '/',
      hash: '#main-content',
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
    expect(reload).toHaveBeenCalledOnce();
    expect(assign).not.toHaveBeenCalled();
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

  it('still navigates to the requested query locale when cookie persistence fails', async () => {
    const { assign } = stubLocation({
      pathname: '/u/juan294',
      search: '?lang=en',
    });
    vi.mocked(setLocaleAction).mockRejectedValueOnce(
      new Error('cookie persistence unavailable')
    );

    render(
      <LanguageProvider initialLocale="en">
        <TestConsumer />
      </LanguageProvider>
    );

    await act(async () => {
      screen.getByText('switch-es').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(assign).toHaveBeenCalledWith('/u/juan294?lang=es');
  });

  it('adds a locale query fallback when canonical cookie persistence fails', async () => {
    const { assign } = stubLocation({ pathname: '/' });
    vi.mocked(setLocaleAction).mockRejectedValueOnce(
      new Error('cookie persistence unavailable')
    );

    render(
      <LanguageProvider initialLocale="en">
        <TestConsumer />
      </LanguageProvider>
    );

    await act(async () => {
      screen.getByText('switch-es').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(assign).toHaveBeenCalledWith('/?lang=es');
  });

  it('reloads through the canonical public path after switching from an internal locale route', async () => {
    const { assign } = stubLocation({
      pathname: '/es',
      search: '?source=release&lang=es',
      hash: '#features',
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

  describe('ancestor dictionary reuse (#1071 — avoid double RSC serialization)', () => {
    function ContextCapture({
      onCapture,
    }: {
      onCapture: (ctx: LanguageContextValue | null) => void;
    }) {
      const ctx = useContext(LanguageContext);
      onCapture(ctx);
      return null;
    }

    function TranslateConsumer() {
      const ctx = useContext(LanguageContext);
      if (!ctx) return <div data-testid="no-ctx">no context</div>;
      return <span data-testid="title">{ctx.t('meta.defaultTitle') as string}</span>;
    }

    it('reuses the exact ancestor context instance when the nested locale matches, instead of creating a fresh provider from its own dictionary', () => {
      let outerCtx: LanguageContextValue | null = null;
      let innerCtx: LanguageContextValue | null = null;

      render(
        <LanguageProvider initialLocale="es" dictionary={es}>
          <ContextCapture
            onCapture={(ctx) => {
              outerCtx = ctx;
            }}
          />
          {/* No dictionary prop passed here — proves the nested provider does not
              need its own serialized copy when an ancestor already matches. */}
          <LanguageProvider initialLocale="es">
            <ContextCapture
              onCapture={(ctx) => {
                innerCtx = ctx;
              }}
            />
          </LanguageProvider>
        </LanguageProvider>
      );

      expect(outerCtx).not.toBeNull();
      // Referential equality is the proxy for "no duplicate dictionary state was
      // created" — a fresh provider would always produce a new context value via
      // its own useMemo, even carrying an equivalent locale/dictionary.
      expect(innerCtx).toBe(outerCtx);
    });

    it('still resolves Spanish translations via the ancestor when the nested provider omits its own dictionary', () => {
      render(
        <LanguageProvider initialLocale="es" dictionary={es}>
          <LanguageProvider initialLocale="es">
            <TranslateConsumer />
          </LanguageProvider>
        </LanguageProvider>
      );

      // Without ancestor reuse this would fall back to the bundled English
      // dictionary (see the "falls back to bundled English" test above),
      // silently regressing #1020's flash fix by disagreeing with the SSR'd
      // Spanish markup one React commit after hydration.
      expect(screen.getByTestId('title').textContent).toBe(
        'Chapa — Impacto de desarrollador, decodificado'
      );
    });

    it('creates its own provider (no reuse) when the nested locale differs from the ancestor', () => {
      const captured: {
        outer: LanguageContextValue | null;
        inner: LanguageContextValue | null;
      } = { outer: null, inner: null };

      render(
        <LanguageProvider initialLocale="es" dictionary={es}>
          <ContextCapture
            onCapture={(ctx) => {
              captured.outer = ctx;
            }}
          />
          <LanguageProvider initialLocale="en">
            <ContextCapture
              onCapture={(ctx) => {
                captured.inner = ctx;
              }}
            />
          </LanguageProvider>
        </LanguageProvider>
      );

      expect(captured.inner).not.toBeNull();
      expect(captured.inner).not.toBe(captured.outer);
      expect(captured.inner?.locale).toBe('en');
      expect(captured.outer?.locale).toBe('es');
    });
  });

  describe('mount-time decision freeze (#1108-repro — /u/:handle duplicate-DOM regression)', () => {
    /**
     * Mirrors the real root layout's own mount effect (provider.tsx lines
     * ~169-191): shortly after mount, it can apply a persisted locale to
     * ITS OWN state — e.g. a `chapa-locale` cookie read once `LocaleSync`'s
     * dataset marker isn't present. Here that's simulated directly via the
     * outer provider's own `setLocale`, changing the ANCESTOR's locale
     * *after* a nested provider has already mounted below it.
     */
    function OuterLocaleFlipper({ to }: { to: 'en' | 'es' }) {
      const ctx = useContext(LanguageContext);
      useEffect(() => {
        void ctx?.setLocale(to, { navigate: false });
        // Only ever run once — flipping on `ctx` identity change would loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }

    it('keeps the nested subtree mounted exactly once when the ancestor locale later comes to match it (no unmount/remount)', async () => {
      let mountCount = 0;
      function MarkerChild() {
        useEffect(() => {
          mountCount += 1;
        }, []);
        return <div data-testid="marker" />;
      }

      render(
        <LanguageProvider initialLocale="es" dictionary={es}>
          <OuterLocaleFlipper to="en" />
          {/* At mount, the ancestor is still "es" — this nested provider
              correctly mounts as a REAL provider (its own state/context),
              matching what SSR committed to for a genuine `?lang=en`
              mismatch page. */}
          <LanguageProvider initialLocale="en">
            <MarkerChild />
          </LanguageProvider>
        </LanguageProvider>
      );

      expect(mountCount).toBe(1);

      // Let the outer's setLocale (and its dictionary import) resolve, so
      // its context value's locale actually becomes "en" — now matching the
      // nested provider's initialLocale for the first time, post-mount.
      await waitFor(() => expect(setLocaleAction).toHaveBeenCalledWith('en'));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Before the fix: re-deriving `ancestor.locale === initialLocale` on
      // this later render flips the nested provider from a real provider to
      // a pass-through Fragment. That's a different element type at the same
      // position, so React unmounts the old subtree (including MarkerChild)
      // and mounts a fresh one — mountCount would become 2. On the real
      // share page this is exactly what let a still-streaming Suspense
      // boundary's original content and a freshly remounted copy both end
      // up in the DOM (duplicate headings, one left `hidden`).
      expect(mountCount).toBe(1);
    });

    it('keeps the nested provider a real, independent context (not reused from the ancestor) even after the ancestor catches up', async () => {
      let innerCtx: LanguageContextValue | null = null;
      let outerCtx: LanguageContextValue | null = null;
      function ContextCapture({
        onCapture,
      }: {
        onCapture: (ctx: LanguageContextValue | null) => void;
      }) {
        onCapture(useContext(LanguageContext));
        return null;
      }

      render(
        <LanguageProvider initialLocale="es" dictionary={es}>
          <OuterLocaleFlipper to="en" />
          <ContextCapture onCapture={(ctx) => { outerCtx = ctx; }} />
          <LanguageProvider initialLocale="en">
            <ContextCapture onCapture={(ctx) => { innerCtx = ctx; }} />
          </LanguageProvider>
        </LanguageProvider>
      );

      const firstInnerCtx = innerCtx;
      expect(firstInnerCtx).not.toBeNull();
      expect(firstInnerCtx).not.toBe(outerCtx);

      await waitFor(() => expect(setLocaleAction).toHaveBeenCalledWith('en'));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // The nested provider must still be the SAME independent context
      // instance it mounted with — never swapped out for the (now-matching)
      // ancestor's context object after the fact.
      expect(innerCtx).toBe(firstInnerCtx);
      expect(innerCtx).not.toBe(outerCtx);
    });
  });
});
