import { z } from 'zod';

export const academicSessionSchema = z.object({
  name: z.string().min(2).max(50),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  isCurrent: z.boolean().default(false),
});

export const gradeSchema = z.object({
  name: z.string().min(1).max(50),
  sortOrder: z.number().int().min(0).default(0),
});

export const sectionSchema = z.object({
  gradeId: z.string().cuid(),
  name: z.string().min(1).max(20),
  capacity: z.number().int().positive().optional(),
});

export const subjectSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  gradeId: z.string().cuid().optional(),
});

export const attendanceStatusSchema = z.object({
  code: z.string().min(1).max(30),
  label: z.string().min(1).max(50),
  countsAsPresent: z.boolean(),
  weight: z.number().min(0).max(1).default(1),
  color: z.string().max(20).optional(),
});

export const gradeBandSchema = z.object({
  minPercent: z.number().min(0).max(100),
  maxPercent: z.number().min(0).max(100),
  grade: z.string().min(1).max(10),
  isPass: z.boolean(),
});

export const gradeScaleSchema = z.object({
  name: z.string().min(1).max(100),
  passPercent: z.number().min(0).max(100).default(33),
  bands: z.array(gradeBandSchema).min(1),
});
