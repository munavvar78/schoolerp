import { describe, expect, it } from 'vitest';
import { bulkEnrollmentSchema } from '../schemas/students.js';

describe('bulkEnrollmentSchema', () => {
  const validCuid1 = 'clh0123456789012345678901';
  const validCuid2 = 'clh0123456789012345678902';
  const validSectionId = 'clh0123456789012345678903';
  const validSessionId = 'clh0123456789012345678904';

  it('validates a correct bulk enrollment payload', () => {
    const parsed = bulkEnrollmentSchema.safeParse({
      studentIds: [validCuid1, validCuid2],
      sectionId: validSectionId,
      sessionId: validSessionId,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects empty studentIds list', () => {
    const parsed = bulkEnrollmentSchema.safeParse({
      studentIds: [],
      sectionId: validSectionId,
      sessionId: validSessionId,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid cuid strings', () => {
    const parsed = bulkEnrollmentSchema.safeParse({
      studentIds: ['not-a-cuid'],
      sectionId: validSectionId,
      sessionId: validSessionId,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects missing sectionId or sessionId', () => {
    const parsed = bulkEnrollmentSchema.safeParse({
      studentIds: [validCuid1],
    });
    expect(parsed.success).toBe(false);
  });
});
