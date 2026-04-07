import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { redisConnection } from './config/redis.config';
import { PrismaModule } from './prisma/prisma.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RemindersConsumer } from './queue/reminders.consumer';
import { AppreciationConsumer } from './queue/appreciation.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    NotificationsModule,
    BullModule.forRoot({ connection: redisConnection() }),
    BullModule.registerQueue({ name: 'reminders' }, { name: 'notifications' }),
  ],
  providers: [RemindersConsumer, AppreciationConsumer],
})
export class WorkerModule {}
