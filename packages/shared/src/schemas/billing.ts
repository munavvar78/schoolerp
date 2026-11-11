import { z } from 'zod';
import { CERTIFICATE_TYPES } from '../domain/certificates.js';
import { ISO_DATE_RE } from '../domain/dates.js';
import { isGstStateCode, isValidGstin } from '../domain/gst.js';

export const buyerStateSchema = z
  .string()
  .regex(/^\d{2}$/)
  .refine(isGstStateCode, 'State code is not a GST state code');

export const gstProfileSchema = z
  .object({
    legalName: z.string().trim().min(2).max(160),
    gstin: z.string().trim().toUpperCase(),
    address: z.string().trim().max(300).optional(),
  })
  .superRefine((value, ctx) => {
    if (!isValidGstin(value.gstin)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'GSTIN is not valid', path: ['gstin'] });
    }
  });

export const createOnlineOrderSchema = z.object({
  feeDemandId: z.string().cuid(),
  amountPaise: z.number().int().positive(),
  buyerStateCode: buyerStateSchema.optional(),
});

export const issueInvoiceSchema = z.object({
  paymentId: z.string().cuid(),
  buyerStateCode: buyerStateSchema.optional(),
});

export const issueCertificateSchema = z
  .object({
    studentId: z.string().cuid(),
    type: z.enum(CERTIFICATE_TYPES),
    purpose: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .refine((value) => !/[\u0000-\u001F]/.test(value), 'Purpose cannot contain control characters'),
    conduct: z.string().trim().max(200).optional(),
    leavingDate: z.string().regex(ISO_DATE_RE).optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'TRANSFER' && !value.leavingDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A transfer certificate needs the date of leaving',
        path: ['leavingDate'],
      });
    }
    if (value.type === 'TRANSFER' && !value.reason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A transfer certificate needs a reason',
        path: ['reason'],
      });
    }
  });
