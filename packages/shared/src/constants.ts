export const BOARDS = ['CBSE', 'ICSE', 'STATE', 'IB', 'CAMBRIDGE'] as const;
export type Board = (typeof BOARDS)[number];

export const FEE_CYCLES = ['MONTHLY', 'QUARTERLY', 'TERM', 'ANNUAL'] as const;
export type FeeCycle = (typeof FEE_CYCLES)[number];

export const PAYMENT_METHODS = ['CASH', 'CHEQUE', 'UPI', 'BANK_TRANSFER', 'CARD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const FIELD_ENTITY_TYPES = ['student', 'guardian', 'staff', 'admission'] as const;
export type FieldEntityType = (typeof FIELD_ENTITY_TYPES)[number];

export const FIELD_TYPES = [
  'TEXT',
  'NUMBER',
  'DATE',
  'SELECT',
  'BOOLEAN',
  'TEXTAREA',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** India-oriented default: academic year typically starts in April. */
export const DEFAULT_ACADEMIC_YEAR_START_MONTH = 4;

export const ADMISSION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'WAITLISTED',
  'OFFERED',
  'ACCEPTED',
  'ENROLLED',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type AdmissionStatus = (typeof ADMISSION_STATUSES)[number];

export const NOTICE_AUDIENCE_TYPES = ['CAMPUS', 'ROLE', 'GRADE', 'SECTION'] as const;
export type NoticeAudienceType = (typeof NOTICE_AUDIENCE_TYPES)[number];

export const NOTICE_PRIORITIES = ['NORMAL', 'HIGH', 'URGENT'] as const;
export type NoticePriority = (typeof NOTICE_PRIORITIES)[number];

export const HOMEWORK_STATUSES = ['ASSIGNED', 'SUBMITTED', 'CHECKED', 'LATE'] as const;
export type HomeworkStatus = (typeof HOMEWORK_STATUSES)[number];
