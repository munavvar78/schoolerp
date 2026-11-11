export type CampusInfo = {
  id: string;
  name: string;
  organization?: { name: string } | null;
};

export type Overview = {
  studentCount: number;
  sectionCount: number;
  attendanceTrend: Array<{ date: string; percentage: number }>;
  feeSummary: { demandTotal: number; collected: number; outstanding: number; count: number };
  subjectAverages: Array<{ subject: string; average: number }>;
  openApplications?: number;
  unpublishedNotices?: number;
};

export type Student = {
  id: string;
  firstName: string;
  lastName?: string | null;
  admissionNo: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  enrollments?: Enrollment[];
  guardians?: Array<{
    isPrimary?: boolean;
    guardian?: {
      name: string;
      relation: string;
      phone?: string | null;
      email?: string | null;
    } | null;
  }>;
};

export type Enrollment = {
  id: string;
  rollNo?: string | null;
  sectionId?: string;
  sessionId?: string;
  section?: { id?: string; name: string; grade?: { name: string } | null } | null;
  session?: { id?: string; name: string; isCurrent?: boolean } | null;
};

export type GradeRow = {
  id: string;
  name: string;
  sections: Array<{ id: string; name: string }>;
};

export type AcademicSession = {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate?: string;
  endDate?: string;
};

export type SubjectRow = { id: string; name: string };

export type AttendanceStatus = {
  code: string;
  label: string;
  countsAsPresent?: boolean;
  color?: string | null;
};

export type AttendanceGrid = {
  enrollments: Array<{
    id: string;
    rollNo?: string | null;
    student: { firstName: string; lastName?: string | null; admissionNo: string };
  }>;
  day?: { locked?: boolean; marks: Array<{ enrollmentId: string; statusCode: string }> } | null;
  statuses: AttendanceStatus[];
};

export type AttendanceRate = { percentage: number; marksCount?: number };

export type FeeDemand = {
  id: string;
  periodLabel: string;
  dueDate: string;
  totalPaise: number;
  concessionPaise?: number;
  paidPaise: number;
  lateFeePaise: number;
  outstandingPaise: number;
  enrollment?: {
    studentId?: string;
    student?: { id: string; firstName: string; lastName?: string | null; admissionNo: string };
    section?: { name: string; grade?: { name: string } | null } | null;
  };
};

export type FeeSummary = {
  demandTotal: number;
  collected: number;
  outstanding: number;
  count: number;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  publishedAt?: string | null;
  expiresAt?: string | null;
  receipts?: Array<{ id: string; readAt?: string | null }>;
};

export type HomeworkItem = {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  subject?: { name: string } | null;
  section?: { name: string; grade?: { name: string } | null } | null;
  childCompletions?: Array<{ status: string }>;
  completions?: Array<{ status: string }>;
};

export type TimetableEntry = {
  id: string;
  dayOfWeek: number;
  periodSlot?: { label: string; startTime: string; endTime: string } | null;
  subject?: { name: string } | null;
  section?: { name: string; grade?: { name: string } | null } | null;
};

export type ExamRow = {
  id: string;
  name: string;
  publishedAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  publications?: Array<{ id: string }>;
  grade?: { name: string } | null;
  session?: { name: string } | null;
};

export type ExamResult = {
  enrollmentId: string;
  student: { id?: string; firstName: string; lastName?: string | null; admissionNo?: string };
  totals: { obtained: number; max: number; percentage: number };
  grade: { grade: string; isPass: boolean };
};

export type AdmissionRow = {
  id: string;
  firstName: string;
  lastName?: string | null;
  status: string;
  contactName: string;
  contactPhone?: string | null;
  admissionFeePaise?: number;
  admissionFeePaidPaise?: number;
  grade?: { name: string } | null;
  session?: { name: string } | null;
  createdAt: string;
};

export type OnlineExamRow = {
  id: string;
  title: string;
  joinCode: string;
  status: string;
  startsAt?: string | null;
  endsAt?: string | null;
  durationMinutes: number;
  requireCamera: boolean;
  maxWarnings?: number;
  faceAbsentSeconds?: number;
  _count?: { questions: number; enrollments: number; attempts: number };
};

export type OnlineQuestionOption = {
  id: string;
  text: string;
  isCorrect?: boolean;
};

export type OnlineExamDetail = OnlineExamRow & {
  faceAbsentSeconds: number;
  maxWarnings: number;
  questions: Array<{
    id: string;
    type: string;
    stem: string;
    marks: number;
    sortOrder: number;
    options: OnlineQuestionOption[];
  }>;
  enrollments: Array<{
    id: string;
    enrollment: {
      student: { firstName: string; lastName?: string | null; admissionNo: string };
    };
  }>;
  attempts: Array<{
    id: string;
    status: string;
    warningCount: number;
    score: number | null;
    maxScore: number | null;
    lockReasonCode: string | null;
    lockReasonMessage: string | null;
    enrollment: { student: { firstName: string; admissionNo: string } };
    proctorEvents: Array<{ id: string; type: string; message: string | null; at: string }>;
  }>;
};
