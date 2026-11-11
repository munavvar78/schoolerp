import { z } from 'zod';

export const noticeAudienceSchema = z.object({
  type: z.enum(['CAMPUS', 'ROLE', 'GRADE', 'SECTION']),
  role: z
    .enum([
      'PLATFORM_OPERATOR',
      'ORG_OWNER',
      'CAMPUS_ADMIN',
      'ACCOUNTANT',
      'TEACHER',
      'CLASS_TEACHER',
      'PARENT',
      'STUDENT',
    ])
    .optional(),
  targetId: z.string().cuid().optional(),
});

export const createNoticeSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  category: z.string().min(1).max(80).default('Academic'),
  priority: z.enum(['NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  expiresAt: z.string().optional(),
  audiences: z.array(noticeAudienceSchema).min(1),
  publish: z.boolean().optional().default(false),
});

export const publishNoticeSchema = z.object({
  noticeId: z.string().cuid(),
});

export const markNoticeReadSchema = z.object({
  noticeId: z.string().cuid(),
});

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;
