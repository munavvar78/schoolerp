import { Module } from '@nestjs/common';
import { AdmissionsModule } from '../admissions/admissions.module.js';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ExamsModule } from '../exams/exams.module.js';
import { FeesModule } from '../fees/fees.module.js';
import { NoticesModule } from '../notices/notices.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [
    AuthModule,
    AttendanceModule,
    FeesModule,
    ExamsModule,
    AdmissionsModule,
    NoticesModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
