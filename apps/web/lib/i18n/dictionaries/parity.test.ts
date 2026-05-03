import { describe, it, expect } from 'vitest';
import { en } from './en';
import { es } from './es';

/**
 * Recursively collects all dotted key paths from a Translations object.
 * Arrays are traversed: `landing.navLinks.0.label`, `landing.navLinks.1.label`, etc.
 * String leaves are collected as-is.
 */
function getAllPaths(obj: unknown, prefix = ''): string[] {
  const paths: string[] = [];

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const fullKey = prefix ? `${prefix}.${i}` : String(i);
      if (typeof item === 'object' && item !== null) {
        paths.push(...getAllPaths(item, fullKey));
      } else {
        paths.push(fullKey);
      }
    });
    return paths;
  }

  if (typeof obj === 'object' && obj !== null) {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = (obj as Record<string, unknown>)[key];
      if (typeof value === 'object' && value !== null) {
        paths.push(...getAllPaths(value, fullKey));
      } else {
        paths.push(fullKey);
      }
    }
    return paths;
  }

  // Primitive leaf
  if (prefix) paths.push(prefix);
  return paths;
}

describe('dictionary parity', () => {
  it('en and es have identical key trees (including array indices)', () => {
    const enPaths = getAllPaths(en).sort();
    const esPaths = getAllPaths(es).sort();
    expect(enPaths).toEqual(esPaths);
  });

  it('en has no empty string leaves', () => {
    const enPaths = getAllPaths(en);
    for (const path of enPaths) {
      const parts = path.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = en;
      for (const part of parts) {
        current = current[part];
      }
      if (typeof current === 'string') {
        expect(current, `en key "${path}" must not be empty`).not.toBe('');
      }
    }
  });

  it('es has no empty string leaves', () => {
    const esPaths = getAllPaths(es);
    for (const path of esPaths) {
      const parts = path.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = es;
      for (const part of parts) {
        current = current[part];
      }
      if (typeof current === 'string') {
        expect(current, `es key "${path}" must not be empty`).not.toBe('');
      }
    }
  });

  it('landing.features has 5 items in both locales', () => {
    const enFeatures = (en as Record<string, unknown> & { landing: { features: unknown[] } }).landing.features;
    const esFeatures = (es as Record<string, unknown> & { landing: { features: unknown[] } }).landing.features;
    expect(enFeatures).toHaveLength(5);
    expect(esFeatures).toHaveLength(5);
  });

  it('landing.steps has 3 items in both locales', () => {
    const enSteps = (en as Record<string, unknown> & { landing: { steps: unknown[] } }).landing.steps;
    const esSteps = (es as Record<string, unknown> & { landing: { steps: unknown[] } }).landing.steps;
    expect(enSteps).toHaveLength(3);
    expect(esSteps).toHaveLength(3);
  });

  it('landing.dimensions has 5 items in both locales', () => {
    const enDims = (en as Record<string, unknown> & { landing: { dimensions: unknown[] } }).landing.dimensions;
    const esDims = (es as Record<string, unknown> & { landing: { dimensions: unknown[] } }).landing.dimensions;
    expect(enDims).toHaveLength(5);
    expect(esDims).toHaveLength(5);
  });

  it('landing.navLinks has 4 items in both locales', () => {
    const enLinks = (en as Record<string, unknown> & { landing: { navLinks: unknown[] } }).landing.navLinks;
    const esLinks = (es as Record<string, unknown> & { landing: { navLinks: unknown[] } }).landing.navLinks;
    expect(enLinks).toHaveLength(4);
    expect(esLinks).toHaveLength(4);
  });
});
