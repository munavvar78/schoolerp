import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { HomeworkController } from './homework.controller.js';
import { HomeworkService } from './homework.service.js';

@Module({
  imports: [AuthModule],
  controllers: [HomeworkController],
  providers: [HomeworkService],
  exports: [HomeworkService],
})
export class HomeworkModule {}
