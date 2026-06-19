// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { LanguageProvider } from './provider';
import { LangSync } from './lang-sync';
import { useContext } from 'react';
import { LanguageContext } from './provider';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

vi.mock('./set-locale-action', () => ({
  setLocaleAction: vi.fn(async () => {}),
}));

describe('LangSync', () => {
  beforeEach(() => {
    document.documentElement.lang = '';
  });

  it('sets document.documentElement.lang to initial locale on mount', () => {
    render(
      <LanguageProvider initialLocale="en">
        <LangSync />
      </LanguageProvider>
    );

    expect(document.documentElement.lang).toBe('en');
  });

  it('sets document.documentElement.lang to "es" when initial locale is es', () => {
    render(
      <LanguageProvider initialLocale="es">
        <LangSync />
      </LanguageProvider>
    );

    expect(document.documentElement.lang).toBe('es');
  });

  it('updates document.documentElement.lang when locale changes', async () => {
    // Use a button that triggers setLocale to avoid component-side-effect lint rules
    function SwitchButton() {
      const ctx = useContext(LanguageContext);
      return (
        <button
          data-testid="switch-es"
          onClick={() => ctx?.setLocale('es')}
        >
          switch
        </button>
      );
    }

    const { getByTestId } = render(
      <LanguageProvider initialLocale="en">
        <LangSync />
        <SwitchButton />
      </LanguageProvider>
    );

    expect(document.documentElement.lang).toBe('en');

    await act(async () => {
      getByTestId('switch-es').click();
    });

    // setLocale now loads the target locale's dictionary client-side (a dynamic
    // import), so the locale — and thus <html lang> — updates one async tick later.
    await waitFor(() => expect(document.documentElement.lang).toBe('es'));
  });
});
