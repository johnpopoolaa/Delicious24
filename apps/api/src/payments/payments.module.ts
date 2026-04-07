import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { TrustModule } from '../trust/trust.module';
import { WatModule } from '../wat/wat.module';

@Module({
  imports: [SchedulerModule, TrustModule, WatModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
