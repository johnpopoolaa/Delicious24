import { BullRootModuleOptions } from '@nestjs/bullmq';

export function redisConnection(): BullRootModuleOptions['connection'] {
  const host = process.env.REDIS_HOST ?? '127.0.0.1';
  const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);
  return { host, port };
}
