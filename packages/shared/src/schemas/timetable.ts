import { z } from 'zod';

export const periodSlotSchema = z.object({
  code: z.string().min(1).max(20),
  label: z.string().min(1).max(80),
  sortOrder: z.number().int().nonnegative().default(0),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const timetableEntrySchema = z.object({
  sessionId: z.string().cuid(),
  sectionId: z.string().cuid(),
  dayOfWeek: z.number().int().min(1).max(7),
  periodSlotId: z.string().cuid(),
  subjectId: z.string().cuid(),
  teacherUserId: z.string().cuid(),
  room: z.string().max(40).optional(),
});

export const upsertTimetableGridSchema = z.object({
  sessionId: z.string().cuid(),
  sectionId: z.string().cuid(),
  entries: z.array(
    z.object({
      dayOfWeek: z.number().int().min(1).max(7),
      periodSlotId: z.string().cuid(),
      subjectId: z.string().cuid(),
      teacherUserId: z.string().cuid(),
      room: z.string().max(40).optional(),
    }),
  ),
});

export type PeriodSlotInput = z.infer<typeof periodSlotSchema>;
export type UpsertTimetableGridInput = z.infer<typeof upsertTimetableGridSchema>;
