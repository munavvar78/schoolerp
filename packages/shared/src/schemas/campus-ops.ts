import { z } from 'zod';
import { APAAR_STATUSES } from '../domain/campus-ops.js';

const id = z.string().cuid();
const text = z.string().trim().min(1).max(160).regex(/^[\p{L}\p{N} .,'()/-]+$/u);
const note = z.string().trim().min(1).max(500).regex(/^[\p{L}\p{N} .,'()/%:+-]+$/u);

export const apaarUpdateSchema = z
  .object({
    studentId: id,
    status: z.enum(APAAR_STATUSES),
    apaarId: z.string().trim().max(12).optional(),
  })
  .strict();

export const libraryBookSchema = z
  .object({
    title: text,
    author: text.optional(),
    barcode: z.string().trim().min(4).max(40).regex(/^[A-Za-z0-9-]+$/),
  })
  .strict();

export const libraryLoanSchema = z
  .object({
    copyId: id,
    studentId: id,
    dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const transportRouteSchema = z
  .object({
    name: text,
    capacity: z.number().int().min(1).max(80),
  })
  .strict();

export const transportAssignSchema = z
  .object({
    routeId: id,
    studentId: id,
  })
  .strict();

export const inventoryItemSchema = z
  .object({
    sku: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9-]+$/),
    name: text,
  })
  .strict();

export const inventoryMoveSchema = z
  .object({
    itemId: id,
    quantityDelta: z.number().int().min(-10000).max(10000).refine((n) => n !== 0),
    reason: note,
  })
  .strict();

export const hostelRoomSchema = z
  .object({
    name: text,
    beds: z.number().int().min(1).max(20),
  })
  .strict();

export const hostelAssignSchema = z
  .object({
    roomId: id,
    studentId: id,
  })
  .strict();

export const staffProfileSchema = z
  .object({
    userId: id,
    employeeCode: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/),
    basicPaise: z.number().int().min(0).max(10_000_000_00),
    hraPaise: z.number().int().min(0).max(10_000_000_00).default(0),
  })
  .strict();

export const leaveRequestSchema = z
  .object({
    staffId: id,
    days: z.number().int().min(1).max(30),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const payrollRunSchema = z
  .object({
    staffId: id,
    periodLabel: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  })
  .strict();

export const outboundMessageSchema = z
  .object({
    channel: z.enum(['SMS', 'WHATSAPP']),
    recipient: z.string().trim().regex(/^\+?[0-9]{10,15}$/),
    body: z.string().trim().min(1).max(480).regex(/^[\p{L}\p{N} .,'!?()/%:+\-\n]+$/u),
    consent: z.boolean(),
  })
  .strict();

export const privacyRequestSchema = z
  .object({
    kind: z.enum(['EXPORT', 'ERASURE']),
  })
  .strict();
