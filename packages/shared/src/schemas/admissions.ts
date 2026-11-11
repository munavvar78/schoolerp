import { z } from 'zod';
import { ISO_DATE_RE, validateNotFutureDate } from '../domain/dates.js';

export const createAdmissionSchema = z
  .object({
    sessionId: z.string().cuid(),
    gradeId: z.string().cuid(),
    firstName: z.string().min(1).max(80),
    lastName: z.string().max(80).optional(),
    dateOfBirth: z.string().regex(ISO_DATE_RE).optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    contactName: z.string().min(1).max(120),
    contactPhone: z.string().max(20).optional(),
    contactEmail: z.string().email().optional().or(z.literal('')),
    customFields: z.record(z.unknown()).optional(),
    submit: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    const check = validateNotFutureDate(value.dateOfBirth, 'Date of birth');
    if (!check.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.message, path: ['dateOfBirth'] });
    }
  });

export const transitionAdmissionSchema = z.object({
  applicationId: z.string().cuid(),
  status: z.enum([
    'SUBMITTED',
    'UNDER_REVIEW',
    'WAITLISTED',
    'OFFERED',
    'ACCEPTED',
    'REJECTED',
    'WITHDRAWN',
  ]),
  note: z.string().max(500).optional(),
});

export const recordAdmissionFeeSchema = z.object({
  applicationId: z.string().cuid(),
  amountPaise: z.number().int().positive(),
  method: z.enum(['CASH', 'CHEQUE', 'UPI', 'BANK_TRANSFER', 'CARD']),
  reference: z.string().max(100).optional(),
});

export const convertAdmissionSchema = z.object({
  applicationId: z.string().cuid(),
  sectionId: z.string().cuid(),
  rollNo: z.string().max(30).optional(),
  admissionNo: z.string().max(40).optional(),
});

export type CreateAdmissionInput = z.infer<typeof createAdmissionSchema>;
export type TransitionAdmissionInput = z.infer<typeof transitionAdmissionSchema>;
export type ConvertAdmissionInput = z.infer<typeof convertAdmissionSchema>;
