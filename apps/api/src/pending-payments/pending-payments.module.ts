import { Module } from '@nestjs/common';
import { PendingPaymentsController } from './pending-payments.controller';
import { PendingPaymentsService } from './pending-payments.service';

@Module({
  controllers: [PendingPaymentsController],
  providers: [PendingPaymentsService],
})
export class PendingPaymentsModule {}
