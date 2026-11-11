import { describe, expect, it } from 'vitest';
import { resolveHomeworkStatus } from './homework.js';

describe('homework late status', () => {
  it('marks assigned work late after due date', () => {
    const status = resolveHomeworkStatus(
      new Date('2026-04-01'),
      new Date('2026-04-03'),
      'ASSIGNED',
      0,
    );
    expect(status).toBe('LATE');
  });

  it('respects grace days', () => {
    const status = resolveHomeworkStatus(
      new Date('2026-04-01'),
      new Date('2026-04-02'),
      'ASSIGNED',
      2,
    );
    expect(status).toBe('ASSIGNED');
  });

  it('keeps checked status', () => {
    const status = resolveHomeworkStatus(
      new Date('2026-04-01'),
      new Date('2026-04-10'),
      'CHECKED',
      0,
    );
    expect(status).toBe('CHECKED');
  });
});
