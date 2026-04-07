import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreditStatus, ScheduledJobStatus, TransactionKind } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';
import { money, settleToNearestTen, toDecimalString } from '../common/money.util';
import { SchedulerService } from '../scheduler/scheduler.service';
import { TrustEngineService } from '../trust/trust-engine.service';
import { WatService } from '../wat/wat.service';
import Decimal from 'decimal.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly trust: TrustEngineService,
    private readonly wat: WatService,
  ) {}

  async confirmPayment(params: {
    creditId: string;
    amount: string;
    note?: string;
    actor: string;
  }) {
    const { creditId, amount, note, actor } = params;
    const credit = await this.prisma.credit.findUnique({
      where: { id: creditId },
      include: { customer: true },
    });
    if (!credit) {
      throw new NotFoundException({ error: 'CREDIT_NOT_FOUND', message: 'Credit not found' });
    }
    if (credit.status !== CreditStatus.ACTIVE && credit.status !== CreditStatus.PENDING_VERIFICATION) {
      throw new BadRequestException({
        error: 'CREDIT_NOT_PAYABLE',
        message: `Credit status ${credit.status} does not accept payments`,
      });
    }

    const paidAt = this.wat.nowUtc();
    const roundedPayment = settleToNearestTen(money(amount));
    if (roundedPayment.lte(0)) {
      throw new BadRequestException({ error: 'INVALID_AMOUNT', message: 'Amount must be positive after rounding' });
    }

    const priorBalance = money(credit.balance.toString());
    let newBalance = priorBalance.minus(roundedPayment);
    let storeCreditAdded = new Decimal(0);
    if (newBalance.lt(0)) {
      storeCreditAdded = newBalance.neg();
      newBalance = new Decimal(0);
    }

    const newStatus = newBalance.lte(0) ? CreditStatus.SETTLED : credit.status;

    const pendingJobKeys =
      newStatus === CreditStatus.SETTLED
        ? (
            await this.prisma.scheduledJob.findMany({
              where: {
                creditId,
                status: { in: [ScheduledJobStatus.PENDING, ScheduledJobStatus.RUNNING] },
              },
              select: { jobKey: true },
            })
          ).map((j) => j.jobKey)
        : [];

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          creditId,
          orderId: credit.orderId ?? undefined,
          amount: roundedPayment.toFixed(2),
          kind: TransactionKind.PAYMENT,
          note:
            note ??
            (storeCreditAdded.gt(0)
              ? `Payment; overpay ${toDecimalString(storeCreditAdded)} to store credit`
              : undefined),
        },
      });

      await tx.credit.update({
        where: { id: creditId },
        data: {
          balance: newBalance.toFixed(2),
          status: newStatus,
        },
      });

      if (storeCreditAdded.gt(0)) {
        const cust = await tx.customer.findUnique({ where: { id: credit.customerId } });
        if (cust) {
          const sc = money(cust.storeCreditBalance.toString()).add(storeCreditAdded);
          await tx.customer.update({
            where: { id: credit.customerId },
            data: { storeCreditBalance: sc.toFixed(2) },
          });
        }
      }

      if (newStatus === CreditStatus.SETTLED) {
        await tx.scheduledJob.updateMany({
          where: {
            creditId,
            status: { in: [ScheduledJobStatus.PENDING, ScheduledJobStatus.RUNNING] },
          },
          data: { status: ScheduledJobStatus.CANCELLED },
        });
      }

      const deltas = this.trust.paymentApplicationDeltas({
        priorBalance,
        newBalance: money(newBalance),
        dueDate: credit.dueDate,
        paidAt,
      });

      let score = credit.customer.trustScore;
      for (const d of deltas) {
        score = this.trust.clamp(score + d.delta);
        await tx.trustScoreEvent.create({
          data: {
            customerId: credit.customerId,
            delta: d.delta,
            reason: d.reason,
            sourceId: creditId,
          },
        });
      }
      const segment = this.trust.segmentForScore(score);
      await tx.customer.update({
        where: { id: credit.customerId },
        data: { trustScore: score, riskSegment: segment },
      });

      await tx.auditLog.create({
        data: {
          actor,
          action: 'confirm_payment',
          targetTable: 'credits',
          targetId: creditId,
          payload: {
            amount: roundedPayment.toFixed(2),
            prior_balance: priorBalance.toFixed(2),
            new_balance: newBalance.toFixed(2),
            store_credit_added: storeCreditAdded.toFixed(2),
            status: newStatus,
          },
        },
      });
    });

    if (newStatus === CreditStatus.SETTLED && pendingJobKeys.length > 0) {
      await this.scheduler.removeJobsByKeys(pendingJobKeys);
    }

    return {
      success: true,
      data: {
        credit_id: creditId,
        payment_amount: roundedPayment.toFixed(2),
        new_balance: newBalance.toFixed(2),
        status: newStatus,
        store_credit_added: storeCreditAdded.toFixed(2),
      },
    };
  }
}
