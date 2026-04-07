import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreditStatus, Prisma, ScheduledJobStatus, ScheduledJobType } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';
import { WatService } from '../wat/wat.service';

export type ReminderJobPayload = {
  scheduledJobId: string;
  jobKey: string;
  creditId: string;
  customerPhone: string;
  reminderType: string;
  templateId: string;
  runAt: string;
};

export type AppreciationJobPayload = {
  scheduledJobId: string;
  jobKey: string;
  customerId: string;
  customerPhone: string;
  orderId: string;
  templateId: string;
  runAt: string;
};

type CreatedReminderRow = {
  id: string;
  jobKey: string;
  creditId: string;
  type: ScheduledJobType;
  runAt: Date;
  templateId: string;
};

@Injectable()
export class SchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wat: WatService,
    @InjectQueue('reminders') private readonly remindersQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  private delayMs(runAt: Date, from: Date): number {
    return Math.max(0, runAt.getTime() - from.getTime());
  }

  /**
   * Inserts three scheduled_jobs rows inside the caller's transaction (atomic with order/credit).
   */
  async createCreditReminderRowsInTransaction(
    tx: Prisma.TransactionClient,
    params: { creditId: string; dueDate: Date; now: Date },
  ): Promise<CreatedReminderRow[]> {
    const { creditId, dueDate, now } = params;
    const runs: Array<{ type: ScheduledJobType; at: Date; template: string }> = [
      { type: ScheduledJobType.COURTESY, at: this.wat.courtesyReminderAt(now), template: 'courtesy_v1' },
      { type: ScheduledJobType.URGENT, at: this.wat.urgentReminderAt(dueDate, now), template: 'urgent_v1' },
      { type: ScheduledJobType.OVERDUE, at: this.wat.overdueReminderAt(dueDate), template: 'overdue_v1' },
    ];
    const out: CreatedReminderRow[] = [];
    for (const r of runs) {
      const slug = r.type.toLowerCase();
      const baseKey = `credit:${creditId}:reminder:${slug}`;
      const runAtIso = r.at.toISOString();
      const jobKey = `${baseKey}:${runAtIso}`;
      const row = await tx.scheduledJob.create({
        data: {
          jobKey,
          creditId,
          type: r.type,
          runAt: r.at,
          status: ScheduledJobStatus.PENDING,
        },
      });
      out.push({
        id: row.id,
        jobKey,
        creditId,
        type: r.type,
        runAt: r.at,
        templateId: r.template,
      });
    }
    return out;
  }

  async enqueueCreditReminderJobs(rows: CreatedReminderRow[], customerPhone: string, now: Date) {
    for (const r of rows) {
      const runAtIso = r.runAt.toISOString();
      await this.remindersQueue.add(
        'send',
        {
          scheduledJobId: r.id,
          jobKey: r.jobKey,
          creditId: r.creditId,
          customerPhone,
          reminderType: r.type,
          templateId: r.templateId,
          runAt: runAtIso,
        } satisfies ReminderJobPayload,
        {
          jobId: r.jobKey,
          delay: this.delayMs(r.runAt, now),
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
        },
      );
    }
  }

  async scheduleAppreciation(params: {
    customerId: string;
    customerPhone: string;
    orderId: string;
    now: Date;
  }) {
    const runAt = this.wat.appreciationSendAt(params.now);
    const runAtIso = runAt.toISOString();
    const jobKey = `customer:${params.customerId}:appreciation:${params.orderId}:${runAtIso}`;
    const row = await this.prisma.scheduledJob.create({
      data: {
        jobKey,
        customerId: params.customerId,
        type: ScheduledJobType.APPRECIATION,
        runAt,
        status: ScheduledJobStatus.PENDING,
      },
    });
    await this.notificationsQueue.add(
      'appreciation',
      {
        scheduledJobId: row.id,
        jobKey,
        customerId: params.customerId,
        customerPhone: params.customerPhone,
        orderId: params.orderId,
        templateId: 'appreciation_v1',
        runAt: runAtIso,
      } satisfies AppreciationJobPayload,
      {
        jobId: jobKey,
        delay: this.delayMs(runAt, params.now),
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );
    return row.id;
  }

  async removeJobsByKeys(jobKeys: string[]) {
    for (const k of jobKeys) {
      await this.remindersQueue.remove(k).catch(() => undefined);
      await this.notificationsQueue.remove(k).catch(() => undefined);
    }
  }

  async cancelPendingJobsForCredit(creditId: string) {
    const pending = await this.prisma.scheduledJob.findMany({
      where: {
        creditId,
        status: { in: [ScheduledJobStatus.PENDING, ScheduledJobStatus.RUNNING] },
      },
    });
    for (const j of pending) {
      await this.remindersQueue.remove(j.jobKey).catch(() => undefined);
      await this.notificationsQueue.remove(j.jobKey).catch(() => undefined);
    }
    await this.prisma.scheduledJob.updateMany({
      where: {
        creditId,
        status: { in: [ScheduledJobStatus.PENDING, ScheduledJobStatus.RUNNING] },
      },
      data: { status: ScheduledJobStatus.CANCELLED },
    });
  }

  async listJobs(filters: {
    creditId?: string;
    status?: ScheduledJobStatus;
    runAtFrom?: Date;
    runAtTo?: Date;
    skip?: number;
    take?: number;
  }) {
    return this.prisma.scheduledJob.findMany({
      where: {
        creditId: filters.creditId,
        status: filters.status,
        runAt: {
          gte: filters.runAtFrom,
          lte: filters.runAtTo,
        },
      },
      orderBy: { runAt: 'asc' },
      skip: filters.skip ?? 0,
      take: Math.min(filters.take ?? 100, 500),
      include: {
        credit: { include: { customer: true } },
        customer: true,
      },
    });
  }

  async cancelJobById(id: string) {
    const job = await this.prisma.scheduledJob.findUnique({ where: { id } });
    if (!job) return null;
    if (job.status === ScheduledJobStatus.COMPLETED || job.status === ScheduledJobStatus.CANCELLED) {
      return job;
    }
    await this.remindersQueue.remove(job.jobKey).catch(() => undefined);
    await this.notificationsQueue.remove(job.jobKey).catch(() => undefined);
    return this.prisma.scheduledJob.update({
      where: { id },
      data: { status: ScheduledJobStatus.CANCELLED },
    });
  }

  async sendNow(id: string) {
    const row = await this.prisma.scheduledJob.findUnique({
      where: { id },
      include: { customer: true, credit: { include: { customer: true } } },
    });
    if (!row) return null;
    if (row.status !== ScheduledJobStatus.PENDING) return row;
    const now = new Date();
    if (row.creditId) {
      const phone = row.credit?.customer.phone ?? '';
      await this.remindersQueue.add(
        'send',
        {
          scheduledJobId: row.id,
          jobKey: row.jobKey,
          creditId: row.creditId,
          customerPhone: phone,
          reminderType: row.type,
          templateId: `manual_${row.type.toLowerCase()}`,
          runAt: now.toISOString(),
        } satisfies ReminderJobPayload,
        {
          jobId: `${row.jobKey}:send-now:${now.getTime()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
        },
      );
    } else if (row.customerId && row.type === ScheduledJobType.APPRECIATION) {
      const phone = row.customer?.phone ?? '';
      await this.notificationsQueue.add(
        'appreciation',
        {
          scheduledJobId: row.id,
          jobKey: row.jobKey,
          customerId: row.customerId,
          customerPhone: phone,
          orderId: 'manual',
          templateId: 'appreciation_v1',
          runAt: now.toISOString(),
        } satisfies AppreciationJobPayload,
        {
          jobId: `${row.jobKey}:send-now:${now.getTime()}`,
          attempts: 3,
        },
      );
    }
    return row;
  }

  async enqueueManualReminder(creditId: string, runAt: Date) {
    const credit = await this.prisma.credit.findUnique({
      where: { id: creditId },
      include: { customer: true },
    });
    if (!credit || credit.status !== CreditStatus.ACTIVE) {
      throw new Error('Credit not found or not active');
    }
    const now = new Date();
    const runAtIso = runAt.toISOString();
    const jobKey = `credit:${creditId}:reminder:manual:${runAtIso}`;
    const row = await this.prisma.scheduledJob.create({
      data: {
        jobKey,
        creditId,
        type: ScheduledJobType.MANUAL,
        runAt,
        status: ScheduledJobStatus.PENDING,
      },
    });
    await this.remindersQueue.add(
      'send',
      {
        scheduledJobId: row.id,
        jobKey,
        creditId,
        customerPhone: credit.customer.phone,
        reminderType: 'MANUAL',
        templateId: 'manual_notice',
        runAt: runAtIso,
      } satisfies ReminderJobPayload,
      {
        jobId: jobKey,
        delay: this.delayMs(runAt, now),
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );
    return row;
  }
}
