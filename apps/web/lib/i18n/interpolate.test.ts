import { describe, it, expect } from 'vitest';
import { interpolate } from './interpolate';

describe('interpolate', () => {
  it('substitutes a single variable', () => {
    expect(interpolate('Hello {name}!', { name: 'World' })).toBe('Hello World!');
  });
  it('substitutes multiple variables', () => {
    expect(interpolate('{a} and {b}', { a: 'foo', b: 'bar' })).toBe('foo and bar');
  });
  it('leaves unknown variables as-is', () => {
    expect(interpolate('Hello {unknown}!', {})).toBe('Hello {unknown}!');
  });
  it('handles empty vars', () => {
    expect(interpolate('no vars here', {})).toBe('no vars here');
  });
});
