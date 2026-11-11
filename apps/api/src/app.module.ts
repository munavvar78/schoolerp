import { Module } from '@nestjs/common';
import { AcademicModule } from './academic/academic.module.js';
import { CertificatesModule } from './certificates/certificates.module.js';
import { CampusOpsModule } from './campus-ops/campus-ops.module.js';
import { AdmissionsModule } from './admissions/admissions.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { ExamsModule } from './exams/exams.module.js';
import { FeesModule } from './fees/fees.module.js';
import { HomeworkModule } from './homework/homework.module.js';
import { NoticesModule } from './notices/notices.module.js';
import { OnlineAssessmentsModule } from './online-assessments/online-assessments.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StudentsModule } from './students/students.module.js';
import { TimetableModule } from './timetable/timetable.module.js';
import { TenantIsolationController } from './tenant/tenant.controller.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AcademicModule,
    StudentsModule,
    AttendanceModule,
    FeesModule,
    ExamsModule,
    DashboardModule,
    NoticesModule,
    AdmissionsModule,
    TimetableModule,
    HomeworkModule,
    OnlineAssessmentsModule,
    CertificatesModule,
    PlatformModule,
    CampusOpsModule,
  ],
  controllers: [TenantIsolationController],
})
export class AppModule {}
