import { z } from 'zod';
import { ISO_DATE_RE, validateAttendanceDate, validateNotFutureDate } from '../domain/dates.js';

export const markAttendanceSchema = z
  .object({
    sectionId: z.string().cuid(),
    sessionId: z.string().cuid(),
    date: z.string().regex(ISO_DATE_RE),
    marks: z
      .array(
        z.object({
          enrollmentId: z.string().cuid(),
          statusCode: z.string().min(1).max(30),
          remark: z.string().max(200).optional(),
        }),
      )
      .default([]),
  })
  .superRefine((value, ctx) => {
    const check = validateAttendanceDate(value.date);
    if (!check.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.message, path: ['date'] });
    }
  });

export const feeHeadSchema = z
  .object({
    name: z.string().min(1).max(100),
    code: z.string().min(1).max(30),
    cycle: z.enum(['MONTHLY', 'QUARTERLY', 'TERM', 'ANNUAL']).default('MONTHLY'),
    gstTreatment: z.enum(['EXEMPT', 'TAXABLE']).default('EXEMPT'),
    /** Basis points. 500 = 5%. Required when the head is taxable. */
    gstRateBps: z.number().int().min(0).max(2800).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.gstTreatment === 'TAXABLE' && value.gstRateBps <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A taxable fee head needs a GST rate',
        path: ['gstRateBps'],
      });
    }
    if (value.gstTreatment === 'EXEMPT' && value.gstRateBps !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'An exempt fee head cannot carry GST',
        path: ['gstRateBps'],
      });
    }
  });

export const feeStructureLineSchema = z.object({
  feeHeadId: z.string().cuid(),
  amountPaise: z.number().int().nonnegative(),
});

export const feeStructureSchema = z.object({
  name: z.string().min(1).max(100),
  gradeId: z.string().cuid(),
  sessionId: z.string().cuid(),
  lines: z.array(feeStructureLineSchema).min(1),
});

export const generateDemandsSchema = z.object({
  feeStructureId: z.string().cuid(),
  periodLabel: z.string().min(1).max(50),
  dueDate: z.string().regex(ISO_DATE_RE),
  sectionId: z.string().cuid().optional(),
});

export const recordPaymentSchema = z
  .object({
    feeDemandId: z.string().cuid(),
    amountPaise: z.number().int().positive(),
    method: z.enum(['CASH', 'CHEQUE', 'UPI', 'BANK_TRANSFER', 'CARD']),
    reference: z.string().max(100).optional(),
    paidAt: z.string().regex(ISO_DATE_RE).optional(),
  })
  .superRefine((value, ctx) => {
    const check = validateNotFutureDate(value.paidAt, 'Payment date');
    if (!check.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.message, path: ['paidAt'] });
    }
  });

export const examSchema = z.object({
  name: z.string().min(1).max(100),
  sessionId: z.string().cuid(),
  gradeId: z.string().cuid(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  components: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        maxMarks: z.number().positive(),
        weight: z.number().positive(),
        subjectId: z.string().cuid().optional(),
      }),
    )
    .min(1),
});

export const saveScoresSchema = z.object({
  examId: z.string().cuid(),
  scores: z.array(
    z.object({
      enrollmentId: z.string().cuid(),
      componentId: z.string().cuid(),
      obtained: z.number().min(0).nullable(),
    }),
  ),
});

export const aiQuerySchema = z.object({
  question: z.string().min(3).max(1000),
  campusId: z.string().cuid().optional(),
});
