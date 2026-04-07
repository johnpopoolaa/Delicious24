/**
 * Custom BullMQ backoff strategy: 1m → 5m → 20m.
 * Register via @Processor settings.backoffStrategy on each worker consumer.
 * Jobs must specify backoff: { type: 'custom' } when enqueued.
 */
export function reminderBackoffDelay(attemptsMade: number): number {
  const delays = [60_000, 300_000, 1_200_000]; // 1m, 5m, 20m
  return delays[Math.min(attemptsMade - 1, delays.length - 1)];
}
