import { z } from 'zod';
import { ISO_DATE_RE, validateNotFutureDate } from '../domain/dates.js';

const studentFields = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80).optional(),
  admissionNo: z.string().min(1).max(40),
  dateOfBirth: z.string().regex(ISO_DATE_RE).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  customFields: z.record(z.unknown()).optional(),
});

function refineDob<T extends { dateOfBirth?: string }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  const check = validateNotFutureDate(value.dateOfBirth, 'Date of birth');
  if (!check.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.message, path: ['dateOfBirth'] });
  }
}

export const studentSchema = studentFields.superRefine(refineDob);

export const guardianSchema = z.object({
  name: z.string().min(1).max(120),
  relation: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER']),
  phone: z.string().min(8).max(20).optional(),
  email: z.string().email().optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const enrollmentSchema = z.object({
  studentId: z.string().cuid(),
  sectionId: z.string().cuid(),
  sessionId: z.string().cuid(),
  rollNo: z.string().min(1).max(20).optional(),
});

export const bulkStudentRowSchema = studentFields
  .extend({
    rollNo: z.string().min(1).max(20).optional(),
  })
  .superRefine(refineDob);

export const bulkStudentsSchema = z
  .object({
    students: z.array(bulkStudentRowSchema).min(1).max(500),
    sessionId: z.string().cuid().optional(),
    sectionId: z.string().cuid().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.sessionId && !value.sectionId) || (!value.sessionId && value.sectionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide both sessionId and sectionId to auto-enroll, or neither',
        path: ['sectionId'],
      });
    }
    const seen = new Set<string>();
    value.students.forEach((row, index) => {
      const key = row.admissionNo.trim().toUpperCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate admission no in request: ${row.admissionNo}`,
          path: ['students', index, 'admissionNo'],
        });
      }
      seen.add(key);
    });
  });

export const bulkEnrollmentSchema = z.object({
  studentIds: z.array(z.string().cuid()).min(1).max(500),
  sectionId: z.string().cuid(),
  sessionId: z.string().cuid(),
});

export type BulkEnrollmentInput = z.infer<typeof bulkEnrollmentSchema>;

export const fieldDefinitionSchema = z.object({
  entityType: z.enum(['student', 'guardian', 'staff']),
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT', 'BOOLEAN', 'TEXTAREA']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  sensitive: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
