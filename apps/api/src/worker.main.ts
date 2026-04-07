import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  await app.init();
  // eslint-disable-next-line no-console
  console.log('BullMQ worker started (reminders + notifications queues)');
}

bootstrap();
