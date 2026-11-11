import { z } from 'zod';

export const createHomeworkSchema = z.object({
  sessionId: z.string().cuid(),
  sectionId: z.string().cuid(),
  subjectId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attachmentUrl: z.string().url().optional().or(z.literal('')),
});

export const markHomeworkCompletionSchema = z.object({
  homeworkId: z.string().cuid(),
  enrollmentId: z.string().cuid(),
  status: z.enum(['ASSIGNED', 'SUBMITTED', 'CHECKED', 'LATE']),
  note: z.string().max(500).optional(),
});

export type CreateHomeworkInput = z.infer<typeof createHomeworkSchema>;
export type MarkHomeworkCompletionInput = z.infer<typeof markHomeworkCompletionSchema>;
