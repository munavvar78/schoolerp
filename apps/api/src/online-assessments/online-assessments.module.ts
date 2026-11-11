import { Module } from '@nestjs/common';
import { OnlineAttemptGuard } from './attempt.guard.js';
import { OnlineAssessmentsController } from './online-assessments.controller.js';
import { OnlineAssessmentsService } from './online-assessments.service.js';

@Module({
  controllers: [OnlineAssessmentsController],
  providers: [OnlineAssessmentsService, OnlineAttemptGuard],
  exports: [OnlineAssessmentsService],
})
export class OnlineAssessmentsModule {}
