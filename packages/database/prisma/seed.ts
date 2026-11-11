import * as argon2 from 'argon2';
import { PrismaClient, Role, Board, FeeCycle, Gender, GuardianRelation } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.messageDispatch.deleteMany();
  await prisma.privacyRequest.deleteMany();
  await prisma.payrollSlip.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.staffProfile.deleteMany();
  await prisma.hostelAllocation.deleteMany();
  await prisma.hostelRoom.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.transportAssignment.deleteMany();
  await prisma.transportRoute.deleteMany();
  await prisma.libraryLoan.deleteMany();
  await prisma.libraryCopy.deleteMany();
  await prisma.libraryBook.deleteMany();
  await prisma.taxInvoice.deleteMany();
  await prisma.onlinePaymentOrder.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.campusGstProfile.deleteMany();
  await prisma.homeworkCompletion.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.timetableEntry.deleteMany();
  await prisma.periodSlot.deleteMany();
  await prisma.noticeReceipt.deleteMany();
  await prisma.noticeAudience.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.admissionEvent.deleteMany();
  await prisma.admissionApplication.deleteMany();
  await prisma.score.deleteMany();
  await prisma.resultPublication.deleteMany();
  await prisma.examComponent.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.feeDemand.deleteMany();
  await prisma.feeStructureLine.deleteMany();
  await prisma.feeStructure.deleteMany();
  await prisma.feeHead.deleteMany();
  await prisma.attendanceMark.deleteMany();
  await prisma.attendanceDay.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.studentGuardian.deleteMany();
  await prisma.guardian.deleteMany();
  await prisma.student.deleteMany();
  await prisma.fieldDefinition.deleteMany();
  await prisma.ruleConfig.deleteMany();
  await prisma.gradeScale.deleteMany();
  await prisma.attendanceStatus.deleteMany();
  await prisma.house.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.section.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.academicSession.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.aiQueryLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.campus.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: {
      name: 'Bharat Vidya Trust',
      slug: 'bharat-vidya',
    },
  });

  const campus = await prisma.campus.create({
    data: {
      organizationId: org.id,
      name: 'Bharat Vidya Public School — Delhi',
      code: 'DEL-01',
      board: Board.CBSE,
      address: 'New Delhi, India',
    },
  });

  const passwordHash = await argon2.hash('Password123!');

  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'admin@bharatvidya.edu',
      name: 'Campus Admin',
      passwordHash,
    },
  });

  const teacher = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'teacher@bharatvidya.edu',
      name: 'Class Teacher',
      passwordHash,
    },
  });

  const accountant = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'accounts@bharatvidya.edu',
      name: 'Accountant',
      passwordHash,
    },
  });

  const parentUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'parent@bharatvidya.edu',
      name: 'Parent User',
      passwordHash,
    },
  });

  const platformUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'master@bharatvidya.edu',
      name: 'Master Admin',
      passwordHash,
    },
  });

  await prisma.membership.createMany({
    data: [
      { organizationId: org.id, userId: admin.id, campusId: campus.id, role: Role.CAMPUS_ADMIN },
      { organizationId: org.id, userId: teacher.id, campusId: campus.id, role: Role.CLASS_TEACHER },
      { organizationId: org.id, userId: accountant.id, campusId: campus.id, role: Role.ACCOUNTANT },
      { organizationId: org.id, userId: parentUser.id, campusId: campus.id, role: Role.PARENT },
      { organizationId: org.id, userId: platformUser.id, campusId: campus.id, role: Role.PLATFORM_OPERATOR },
    ],
  });

  const session = await prisma.academicSession.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      name: '2026-27',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      isCurrent: true,
    },
  });

  const grade = await prisma.grade.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      name: 'Class 8',
      sortOrder: 8,
    },
  });

  const section = await prisma.section.create({
    data: { gradeId: grade.id, name: 'A', capacity: 40 },
  });

  await prisma.subject.createMany({
    data: [
      { organizationId: org.id, campusId: campus.id, gradeId: grade.id, name: 'Mathematics', code: 'MATH' },
      { organizationId: org.id, campusId: campus.id, gradeId: grade.id, name: 'Science', code: 'SCI' },
      { organizationId: org.id, campusId: campus.id, gradeId: grade.id, name: 'English', code: 'ENG' },
    ],
  });

  await prisma.attendanceStatus.createMany({
    data: [
      { organizationId: org.id, campusId: campus.id, code: 'PRESENT', label: 'Present', countsAsPresent: true, weight: 1, color: '#16a34a' },
      { organizationId: org.id, campusId: campus.id, code: 'ABSENT', label: 'Absent', countsAsPresent: false, weight: 1, color: '#dc2626' },
      { organizationId: org.id, campusId: campus.id, code: 'LATE', label: 'Late', countsAsPresent: true, weight: 1, color: '#ea580c' },
      { organizationId: org.id, campusId: campus.id, code: 'HALF_DAY', label: 'Half Day', countsAsPresent: true, weight: 0.5, color: '#ca8a04' },
      { organizationId: org.id, campusId: campus.id, code: 'EXCUSED', label: 'Excused', countsAsPresent: false, weight: 1, color: '#64748b' },
    ],
  });

  const gradeScale = await prisma.gradeScale.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      name: 'CBSE 8-point',
      passPercent: 33,
      bands: [
        { minPercent: 91, maxPercent: 100, grade: 'A1', isPass: true },
        { minPercent: 81, maxPercent: 90, grade: 'A2', isPass: true },
        { minPercent: 71, maxPercent: 80, grade: 'B1', isPass: true },
        { minPercent: 61, maxPercent: 70, grade: 'B2', isPass: true },
        { minPercent: 51, maxPercent: 60, grade: 'C1', isPass: true },
        { minPercent: 41, maxPercent: 50, grade: 'C2', isPass: true },
        { minPercent: 33, maxPercent: 40, grade: 'D', isPass: true },
        { minPercent: 0, maxPercent: 32.99, grade: 'E', isPass: false },
      ],
    },
  });

  await prisma.ruleConfig.createMany({
    data: [
      {
        organizationId: org.id,
        campusId: campus.id,
        key: 'late_fee',
        value: { fixedPaise: 5000, percent: 2, graceDays: 7 },
      },
      {
        organizationId: org.id,
        campusId: campus.id,
        key: 'attendance_shortage',
        value: { thresholdPercent: 75 },
      },
      {
        organizationId: org.id,
        campusId: campus.id,
        key: 'admission_fee',
        value: { amountPaise: 250000 },
      },
      {
        organizationId: org.id,
        campusId: campus.id,
        key: 'admission_number_prefix',
        value: { prefix: 'ADM-' },
      },
      {
        organizationId: org.id,
        campusId: campus.id,
        key: 'notice_categories',
        value: { categories: ['Academic', 'Fee', 'Holiday', 'Urgent'] },
      },
      {
        organizationId: org.id,
        campusId: campus.id,
        key: 'timetable_week',
        value: { workingDays: [1, 2, 3, 4, 5, 6], saturdays: 'on' },
      },
      {
        organizationId: org.id,
        campusId: campus.id,
        key: 'homework_late_grace_days',
        value: { days: 1 },
      },
    ],
  });

  await prisma.fieldDefinition.createMany({
    data: [
      {
        organizationId: org.id,
        campusId: campus.id,
        entityType: 'student',
        key: 'bloodGroup',
        label: 'Blood Group',
        fieldType: 'SELECT',
        options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
        sortOrder: 1,
      },
      {
        organizationId: org.id,
        campusId: campus.id,
        entityType: 'student',
        key: 'category',
        label: 'Category',
        fieldType: 'SELECT',
        options: ['General', 'OBC', 'SC', 'ST'],
        sensitive: true,
        sortOrder: 2,
      },
      {
        organizationId: org.id,
        campusId: campus.id,
        entityType: 'admission',
        key: 'previousSchool',
        label: 'Previous School',
        fieldType: 'TEXT',
        sortOrder: 1,
      },
    ],
  });

  const students = await Promise.all(
    [
      ['Aarav', 'Sharma', 'ADM-8001', '1'],
      ['Ananya', 'Gupta', 'ADM-8002', '2'],
      ['Kabir', 'Singh', 'ADM-8003', '3'],
      ['Diya', 'Patel', 'ADM-8004', '4'],
      ['Ishaan', 'Mehta', 'ADM-8005', '5'],
    ].map(([firstName, lastName, admissionNo, rollNo]) =>
      prisma.student.create({
        data: {
          organizationId: org.id,
          campusId: campus.id,
          firstName,
          lastName,
          admissionNo,
          gender: Gender.OTHER,
          customFields: { bloodGroup: 'O+' },
          enrollments: {
            create: {
              sectionId: section.id,
              sessionId: session.id,
              rollNo,
            },
          },
        },
        include: { enrollments: true },
      }),
    ),
  );

  const guardian = await prisma.guardian.create({
    data: {
      organizationId: org.id,
      name: 'Parent User',
      relation: GuardianRelation.FATHER,
      phone: '9876543210',
      email: 'parent@bharatvidya.edu',
      userId: parentUser.id,
      students: {
        create: {
          studentId: students[0]!.id,
          isPrimary: true,
        },
      },
    },
  });

  const tuition = await prisma.feeHead.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      name: 'Tuition Fee',
      code: 'TUITION',
      cycle: FeeCycle.MONTHLY,
    },
  });

  const transport = await prisma.feeHead.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      name: 'Transport',
      code: 'TRANSPORT',
      cycle: FeeCycle.MONTHLY,
      gstTreatment: 'TAXABLE',
      gstRateBps: 500,
    },
  });

  await prisma.campusGstProfile.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      legalName: 'Bharat Vidya Trust',
      gstin: '07AAAAA0000A1Z4',
      stateCode: '07',
      address: 'New Delhi, India',
    },
  });

  const feeStructure = await prisma.feeStructure.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      sessionId: session.id,
      gradeId: grade.id,
      name: 'Class 8 Monthly',
      lines: {
        create: [
          { feeHeadId: tuition.id, amountPaise: 450000 },
          { feeHeadId: transport.id, amountPaise: 150000 },
        ],
      },
    },
  });

  for (const student of students) {
    const enrollment = student.enrollments[0]!;
    await prisma.feeDemand.create({
      data: {
        organizationId: org.id,
        feeStructureId: feeStructure.id,
        enrollmentId: enrollment.id,
        periodLabel: 'Apr-2026',
        dueDate: new Date('2026-04-10'),
        totalPaise: 600000,
      },
    });
  }

  const math = await prisma.subject.findFirstOrThrow({ where: { code: 'MATH', campusId: campus.id } });
  const sci = await prisma.subject.findFirstOrThrow({ where: { code: 'SCI', campusId: campus.id } });

  const exam = await prisma.exam.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      sessionId: session.id,
      gradeId: grade.id,
      gradeScaleId: gradeScale.id,
      name: 'Term 1',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-15'),
      components: {
        create: [
          { name: 'Math Written', subjectId: math.id, maxMarks: 80, weight: 70 },
          { name: 'Science Written', subjectId: sci.id, maxMarks: 80, weight: 30 },
        ],
      },
    },
    include: { components: true },
  });

  for (const student of students) {
    const enrollment = student.enrollments[0]!;
    for (const component of exam.components) {
      await prisma.score.create({
        data: {
          componentId: component.id,
          enrollmentId: enrollment.id,
          obtained: 55 + Math.floor(Math.random() * 20),
        },
      });
    }
  }

  const day = await prisma.attendanceDay.create({
    data: {
      sectionId: section.id,
      sessionId: session.id,
      date: new Date('2026-04-07'),
    },
  });

  for (const [index, student] of students.entries()) {
    await prisma.attendanceMark.create({
      data: {
        dayId: day.id,
        enrollmentId: student.enrollments[0]!.id,
        statusCode: index === 2 ? 'ABSENT' : 'PRESENT',
      },
    });
  }

  await prisma.periodSlot.createMany({
    data: [
      {
        organizationId: org.id,
        campusId: campus.id,
        code: 'P1',
        label: 'Period 1',
        sortOrder: 1,
        startTime: '08:00',
        endTime: '08:45',
      },
      {
        organizationId: org.id,
        campusId: campus.id,
        code: 'P2',
        label: 'Period 2',
        sortOrder: 2,
        startTime: '08:45',
        endTime: '09:30',
      },
      {
        organizationId: org.id,
        campusId: campus.id,
        code: 'P3',
        label: 'Period 3',
        sortOrder: 3,
        startTime: '09:45',
        endTime: '10:30',
      },
    ],
  });

  const p1 = await prisma.periodSlot.findFirstOrThrow({
    where: { campusId: campus.id, code: 'P1' },
  });
  const eng = await prisma.subject.findFirstOrThrow({
    where: { code: 'ENG', campusId: campus.id },
  });

  await prisma.timetableEntry.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      sessionId: session.id,
      sectionId: section.id,
      dayOfWeek: 1,
      periodSlotId: p1.id,
      subjectId: math.id,
      teacherUserId: teacher.id,
      room: 'R-101',
    },
  });

  await prisma.timetableEntry.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      sessionId: session.id,
      sectionId: section.id,
      dayOfWeek: 1,
      periodSlotId: (
        await prisma.periodSlot.findFirstOrThrow({
          where: { campusId: campus.id, code: 'P2' },
        })
      ).id,
      subjectId: eng.id,
      teacherUserId: teacher.id,
      room: 'R-101',
    },
  });

  const homework = await prisma.homework.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      sessionId: session.id,
      sectionId: section.id,
      subjectId: math.id,
      title: 'Algebra worksheet 1',
      description: 'Complete exercise 3.1 questions 1–10',
      dueDate: new Date('2026-04-15'),
      createdByUserId: teacher.id,
    },
  });

  for (const student of students) {
    await prisma.homeworkCompletion.create({
      data: {
        homeworkId: homework.id,
        enrollmentId: student.enrollments[0]!.id,
        status: 'ASSIGNED',
      },
    });
  }

  await prisma.notice.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      title: 'Welcome to the 2026-27 session',
      body: 'Classes begin on 7 April. Please ensure fee clearance before mid-April.',
      category: 'Academic',
      priority: 'NORMAL',
      publishedAt: new Date(),
      createdByUserId: admin.id,
      audiences: {
        create: [{ type: 'CAMPUS' }, { type: 'ROLE', role: Role.PARENT }],
      },
    },
  });

  await prisma.admissionApplication.create({
    data: {
      organizationId: org.id,
      campusId: campus.id,
      sessionId: session.id,
      gradeId: grade.id,
      firstName: 'Riya',
      lastName: 'Kapoor',
      contactName: 'Mr Kapoor',
      contactPhone: '9988776655',
      contactEmail: 'kapoor@example.com',
      status: 'SUBMITTED',
      admissionFeePaise: 250000,
      customFields: { previousSchool: 'Delhi Public School' },
      events: {
        create: {
          fromStatus: null,
          toStatus: 'SUBMITTED',
          actorUserId: admin.id,
          note: 'Demo application',
        },
      },
    },
  });

  console.log('Seed complete');
  console.log({
    org: org.slug,
    campus: campus.code,
    admin: 'admin@bharatvidya.edu',
    teacher: 'teacher@bharatvidya.edu',
    accountant: 'accounts@bharatvidya.edu',
    parent: 'parent@bharatvidya.edu',
    password: 'Password123!',
    guardianId: guardian.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
