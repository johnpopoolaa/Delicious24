import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { TrustModule } from '../trust/trust.module';

@Module({
  imports: [SchedulerModule, TrustModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
