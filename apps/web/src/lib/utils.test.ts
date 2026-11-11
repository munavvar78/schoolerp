import { describe, expect, it } from 'vitest';
import { formatInr } from './utils';

describe('formatInr', () => {
  it('converts paise to INR', () => {
    expect(formatInr(125050)).toContain('1,250.50');
  });
});
