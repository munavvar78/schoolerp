import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BillingService } from './billing.service.js';
import { FeesController } from './fees.controller.js';
import { FeesService } from './fees.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FeesController],
  providers: [FeesService, BillingService],
  exports: [FeesService],
})
export class FeesModule {}
