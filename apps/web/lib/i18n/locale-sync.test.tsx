// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { LocaleSync } from './locale-sync';

// Mock the server action
vi.mock('./set-locale-action', () => ({
  setLocaleAction: vi.fn().mockResolvedValue(undefined),
}));

import { setLocaleAction } from './set-locale-action';

describe('LocaleSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null (no DOM output)', () => {
    const { container } = render(<LocaleSync />);
    expect(container.firstChild).toBeNull();
  });

  it('calls setLocaleAction when queryLang is a valid locale (en)', () => {
    render(<LocaleSync queryLang="en" />);
    expect(setLocaleAction).toHaveBeenCalledWith('en');
  });

  it('calls setLocaleAction when queryLang is a valid locale (es)', () => {
    render(<LocaleSync queryLang="es" />);
    expect(setLocaleAction).toHaveBeenCalledWith('es');
  });

  it('does NOT call setLocaleAction when queryLang is undefined', () => {
    render(<LocaleSync queryLang={undefined} />);
    expect(setLocaleAction).not.toHaveBeenCalled();
  });

  it('does NOT call setLocaleAction when queryLang is null', () => {
    render(<LocaleSync queryLang={null} />);
    expect(setLocaleAction).not.toHaveBeenCalled();
  });

  it('does NOT call setLocaleAction when queryLang is an unsupported locale', () => {
    render(<LocaleSync queryLang="fr" />);
    expect(setLocaleAction).not.toHaveBeenCalled();
  });

  it('does NOT call setLocaleAction when queryLang is an empty string', () => {
    render(<LocaleSync queryLang="" />);
    expect(setLocaleAction).not.toHaveBeenCalled();
  });
});
