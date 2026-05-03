import { describe, it, expect } from 'vitest';
import { en } from './en';
import { es } from './es';

function getAllPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      paths.push(...getAllPaths(value as Record<string, unknown>, fullKey));
    } else {
      paths.push(fullKey);
    }
  }
  return paths;
}

describe('dictionary parity', () => {
  it('en and es have identical key trees', () => {
    const enPaths = getAllPaths(en as unknown as Record<string, unknown>).sort();
    const esPaths = getAllPaths(es as unknown as Record<string, unknown>).sort();
    expect(enPaths).toEqual(esPaths);
  });

  it('en has no empty string leaves', () => {
    const enPaths = getAllPaths(en as unknown as Record<string, unknown>);
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
    const esPaths = getAllPaths(es as unknown as Record<string, unknown>);
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
});
