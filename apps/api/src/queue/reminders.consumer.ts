import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScheduledJobStatus } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationSenderService } from '../notifications/notification-sender.service';
import type { ReminderJobPayload } from '../scheduler/scheduler.service';
import { reminderBackoffDelay } from '../config/backoff.config';

@Processor('reminders', { concurrency: 4, settings: { backoffStrategy: reminderBackoffDelay } })
export class RemindersConsumer extends WorkerHost {
  private readonly log = new Logger(RemindersConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: NotificationSenderService,
  ) {
    super();
  }

  async process(job: Job<ReminderJobPayload>): Promise<void> {
    const { scheduledJobId, creditId, reminderType, templateId } = job.data;
    const row = await this.prisma.scheduledJob.findUnique({ where: { id: scheduledJobId } });
    if (!row || row.status === ScheduledJobStatus.CANCELLED || row.status === ScheduledJobStatus.COMPLETED) {
      return;
    }
    const locked = await this.prisma.scheduledJob.updateMany({
      where: { id: scheduledJobId, status: ScheduledJobStatus.PENDING },
      data: { status: ScheduledJobStatus.RUNNING, attempts: { increment: 1 } },
    });
    if (locked.count === 0) {
      const again = await this.prisma.scheduledJob.findUnique({ where: { id: scheduledJobId } });
      if (again?.status === ScheduledJobStatus.COMPLETED) return;
      throw new Error('REMINDER_LOCK_CONTENTION');
    }
    try {
      await this.sender.sendReminder({ scheduledJobId, creditId, reminderType, templateId });
      await this.prisma.scheduledJob.update({
        where: { id: scheduledJobId },
        data: { status: ScheduledJobStatus.COMPLETED },
      });
    } catch (e) {
      await this.prisma.scheduledJob.update({
        where: { id: scheduledJobId },
        data: { status: ScheduledJobStatus.PENDING },
      });
      throw e;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ReminderJobPayload>, err: Error): Promise<void> {
    const attempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= attempts) {
      await this.prisma.scheduledJob.updateMany({
        where: { id: job.data.scheduledJobId },
        data: { status: ScheduledJobStatus.FAILED, lastError: err.message },
      });
      this.log.warn(`Reminder job permanently failed: ${job.data.jobKey} — ${err.message}`);
    }
  }
}
