import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FeesModule } from '../fees/fees.module.js';
import { CertificatesController } from './certificates.controller.js';
import { CertificatesService } from './certificates.service.js';

@Module({
  imports: [AuthModule, FeesModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
})
export class CertificatesModule {}
