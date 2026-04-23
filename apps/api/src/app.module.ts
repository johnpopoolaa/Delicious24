import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ApiKeyGuard } from './common/api-key.guard';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { redisConnection } from './config/redis.config';
import { PrismaModule } from './prisma/prisma.module';
import { IdempotencyInterceptor } from './common/idempotency.interceptor';
import { OrdersModule } from './orders/orders.module';
import { CustomersModule } from './customers/customers.module';
import { PaymentsModule } from './payments/payments.module';
import { WebhookModule } from './webhook/webhook.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { SyncModule } from './sync/sync.module';
import { MenuModule } from './menu/menu.module';
import { PendingPaymentsModule } from './pending-payments/pending-payments.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    BullModule.forRoot({ connection: redisConnection() }),
    PrismaModule,
    OrdersModule,
    CustomersModule,
    PaymentsModule,
    WebhookModule,
    SchedulerModule,
    SyncModule,
    MenuModule,
    PendingPaymentsModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}
