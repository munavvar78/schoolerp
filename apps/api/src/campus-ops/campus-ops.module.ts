import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  ApaarController,
  HostelController,
  HrController,
  InventoryController,
  LibraryController,
  MessagesController,
  PayrollController,
  PrivacyController,
  TransportController,
} from './campus-ops.controller.js';
import { CampusOpsService } from './campus-ops.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    ApaarController,
    LibraryController,
    TransportController,
    InventoryController,
    HostelController,
    HrController,
    PayrollController,
    MessagesController,
    PrivacyController,
  ],
  providers: [CampusOpsService],
})
export class CampusOpsModule {}
