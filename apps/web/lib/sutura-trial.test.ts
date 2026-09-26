import { expect, test } from 'vitest';
import { addTrialNumbers } from './sutura-trial';

test('Sutura controlled CI trial adds two numbers', () => {
  expect(addTrialNumbers(2, 3)).toBe(5);
});
