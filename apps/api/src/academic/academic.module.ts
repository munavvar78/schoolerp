import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AcademicController } from './academic.controller.js';
import { AcademicService } from './academic.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AcademicController],
  providers: [AcademicService],
  exports: [AcademicService],
})
export class AcademicModule {}
