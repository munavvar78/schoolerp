import { z } from 'zod';

export const onlineQuestionTypes = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'YES_NO',
  'THIS_OR_THAT',
  /** @deprecated use SINGLE_CHOICE */
  'MCQ',
  'SHORT_TEXT',
] as const;

export type OnlineQuestionTypeInput = (typeof onlineQuestionTypes)[number];

const mcqOptionSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().min(1).max(500),
  isCorrect: z.boolean(),
});

function normalizeQuestionType(type: OnlineQuestionTypeInput): OnlineQuestionTypeInput {
  if (type === 'MCQ') return 'SINGLE_CHOICE';
  return type;
}

export const onlineQuestionInputSchema = z
  .object({
    type: z.enum(onlineQuestionTypes).default('SINGLE_CHOICE'),
    stem: z.string().min(1).max(4000),
    marks: z.number().positive().max(100).default(1),
    sortOrder: z.number().int().min(0).default(0),
    options: z.array(mcqOptionSchema).min(2).max(8),
  })
  .superRefine((value, ctx) => {
    const type = normalizeQuestionType(value.type);
    const correct = value.options.filter((o) => o.isCorrect).length;

    if (type === 'SINGLE_CHOICE' || type === 'YES_NO' || type === 'THIS_OR_THAT') {
      if (correct !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Exactly one correct option is required',
          path: ['options'],
        });
      }
    }

    if (type === 'MULTIPLE_CHOICE') {
      if (correct < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select at least two correct options',
          path: ['options'],
        });
      }
    }

    if (type === 'YES_NO' || type === 'THIS_OR_THAT') {
      if (value.options.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${type} requires exactly two options`,
          path: ['options'],
        });
      }
    }

    if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') {
      if (value.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least two options are required',
          path: ['options'],
        });
      }
    }

    if (type === 'SHORT_TEXT') {
      // unused in UI; allow any options payload for legacy rows
    }
  })
  .transform((value) => ({
    ...value,
    type: normalizeQuestionType(value.type),
  }));

export const createOnlineAssessmentSchema = z.object({
  title: z.string().min(1).max(200),
  sessionId: z.string().cuid(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(5).max(360).default(60),
  pin: z.string().min(4).max(12).optional(),
  requireCamera: z.boolean().default(true),
  maxWarnings: z.number().int().min(1).max(10).default(3),
  faceAbsentSeconds: z.number().int().min(5).max(600).default(10),
  shuffleQuestions: z.boolean().default(false),
  status: z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'CLOSED']).default('DRAFT'),
  questions: z.array(onlineQuestionInputSchema).max(100).default([]),
});

export const addOnlineQuestionSchema = z.object({
  assessmentId: z.string().cuid(),
  question: onlineQuestionInputSchema,
});

export const updateOnlineQuestionSchema = z.object({
  assessmentId: z.string().cuid(),
  questionId: z.string().cuid(),
  question: onlineQuestionInputSchema,
});

export const deleteOnlineQuestionSchema = z.object({
  assessmentId: z.string().cuid(),
  questionId: z.string().cuid(),
});

export const updateOnlineAssessmentStatusSchema = z.object({
  assessmentId: z.string().cuid(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'CLOSED']),
});

export const updateOnlineAssessmentSettingsSchema = z.object({
  assessmentId: z.string().cuid(),
  title: z.string().min(1).max(200).optional(),
  durationMinutes: z.number().int().min(5).max(360).optional(),
  requireCamera: z.boolean().optional(),
  maxWarnings: z.number().int().min(1).max(10).optional(),
  faceAbsentSeconds: z.number().int().min(5).max(600).optional(),
});

export const deleteOnlineAssessmentSchema = z.object({
  assessmentId: z.string().cuid(),
});

export const enrollSectionSchema = z.object({
  assessmentId: z.string().cuid(),
  sectionId: z.string().cuid(),
});

export const joinOnlineAssessmentSchema = z.object({
  joinCode: z.string().min(4).max(12),
  admissionNo: z.string().min(1).max(40),
  pin: z.string().min(4).max(12).optional(),
});

export const saveOnlineAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().cuid(),
        selectedOptionIds: z.array(z.string().min(1).max(40)).max(8),
      }),
    )
    .min(1)
    .max(100),
});

export const proctorEventSchema = z.object({
  type: z.enum([
    'TAB_BLUR',
    'TAB_HIDDEN',
    'FULLSCREEN_EXIT',
    'CAMERA_FACE_MISSING',
    'CAMERA_FACE_MISSING_TIMEOUT',
    'CAMERA_MULTI_FACE',
    'CAMERA_LOOKING_AWAY',
    'CAMERA_STREAM_LOST',
    'CAMERA_DENIED',
    'HEARTBEAT',
  ]),
  message: z.string().max(500).optional(),
  meta: z.record(z.unknown()).optional(),
});

export const unlockAttemptSchema = z.object({
  attemptId: z.string().cuid(),
  resetWarnings: z.boolean().optional(),
});
