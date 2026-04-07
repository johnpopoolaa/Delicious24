import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WatModule } from '../wat/wat.module';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [WatModule, BullModule.registerQueue({ name: 'reminders' }, { name: 'notifications' })],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService, BullModule],
})
export class SchedulerModule {}
