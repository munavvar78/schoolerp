import { describe, expect, it } from 'vitest';
import { MODULES } from '../roles.js';
import { assertEnabledModules } from './platform.js';

describe('organization modules', () => {
  it('keeps known modules and drops duplicates', () => {
    const result = assertEnabledModules(['fees', 'fees', 'students']);
    expect(result).toEqual({ ok: true, modules: ['students', 'fees'] });
  });

  it('rejects an unknown module and an empty selection', () => {
    expect(assertEnabledModules(['not-a-module']).ok).toBe(false);
    expect(assertEnabledModules([]).ok).toBe(false);
  });

  it('accepts the full catalog', () => {
    const result = assertEnabledModules([...MODULES]);
    expect(result.ok).toBe(true);
  });
});
