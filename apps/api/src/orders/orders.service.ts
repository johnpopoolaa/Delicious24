import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreditStatus, OrderType, Prisma, TransactionKind } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';
import { money, toDecimalString } from '../common/money.util';
import { SchedulerService } from '../scheduler/scheduler.service';
import { TrustEngineService } from '../trust/trust-engine.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly trust: TrustEngineService,
  ) {}

  async create(dto: CreateOrderDto, actor: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customer_id } });
    if (!customer) throw new NotFoundException({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer does not exist' });

    const needsCredit = dto.type === OrderType.CREDIT;
    if (needsCredit && !dto.due_date) {
      throw new BadRequestException({ error: 'DUE_DATE_REQUIRED', message: 'due_date is required for credit sales' });
    }

    const lines: Array<{ menuItemId: number; qty: number; unitPrice: Prisma.Decimal }> = [];
    let computed = money(0);

    for (const line of dto.items) {
      const item = await this.prisma.menuItem.findUnique({ where: { id: line.menu_item_id } });
      if (!item) {
        throw new BadRequestException({
          error: 'MENU_ITEM_NOT_FOUND',
          message: `menu_item_id ${line.menu_item_id} not found`,
        });
      }
      if (!item.inStock) {
        throw new BadRequestException({ error: 'OUT_OF_STOCK', message: `Item ${item.name} is out of stock` });
      }
      const unit = money(item.price.toString());
      const sub = unit.mul(line.qty);
      computed = computed.add(sub);
      lines.push({ menuItemId: item.id, qty: line.qty, unitPrice: item.price });
    }

    const declared = money(dto.total);
    if (!computed.equals(declared)) {
      throw new BadRequestException({
        error: 'TOTAL_MISMATCH',
        message: `total ${dto.total} does not match line sum ${toDecimalString(computed)}`,
      });
    }

    const now = new Date();
    const dueDate = dto.due_date ? new Date(dto.due_date) : now;

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerId: dto.customer_id,
          total: computed.toFixed(2),
          type: dto.type,
          note: dto.note,
          lines: {
            create: lines.map((l) => ({
              menuItemId: l.menuItemId,
              quantity: l.qty,
              unitPrice: l.unitPrice,
            })),
          },
        },
      });

      await tx.transaction.create({
        data: {
          orderId: order.id,
          amount: computed.toFixed(2),
          kind: TransactionKind.CHARGE,
          note: dto.note,
        },
      });

      let creditId: string | null = null;
      let reminderRows: Awaited<ReturnType<SchedulerService['createCreditReminderRowsInTransaction']>> = [];

      if (needsCredit) {
        await tx.credit.create({
          data: {
            orderId: order.id,
            customerId: dto.customer_id,
            principal: computed.toFixed(2),
            balance: computed.toFixed(2),
            dueDate,
            status: CreditStatus.ACTIVE,
          },
        });
        const creditRow = await tx.credit.findFirst({
          where: { orderId: order.id },
          orderBy: { createdAt: 'desc' },
        });
        creditId = creditRow!.id;
        reminderRows = await this.scheduler.createCreditReminderRowsInTransaction(tx, {
          creditId: creditRow!.id,
          dueDate,
          now,
        });
      }

      // For outright PAID orders: record trust score event atomically with the order
      if (dto.type === OrderType.PAID) {
        const delta = this.trust.outrightPaidSaleDelta();
        const next = this.trust.clamp(customer.trustScore + delta.delta);
        const segment = this.trust.segmentForScore(next);
        await tx.trustScoreEvent.create({
          data: {
            customerId: dto.customer_id,
            delta: delta.delta,
            reason: delta.reason,
            sourceId: order.id,
          },
        });
        await tx.customer.update({
          where: { id: dto.customer_id },
          data: { trustScore: next, riskSegment: segment },
        });
        await tx.auditLog.create({
          data: {
            actor,
            action: 'trust_outright_paid',
            targetTable: 'customers',
            targetId: dto.customer_id,
            payload: { order_id: order.id, delta: delta.delta },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actor,
          action: 'create_order',
          targetTable: 'orders',
          targetId: order.id,
          payload: { type: dto.type, customer_id: dto.customer_id, total: dto.total },
        },
      });

      return { order, creditId, computed, dueDate, reminderRows };
    });

    if (result.reminderRows.length > 0) {
      await this.scheduler.enqueueCreditReminderJobs(result.reminderRows, customer.phone, now);
    }

    // Thank-you message — fires ~2 min after the sale for both order types
    await this.scheduler.scheduleAppreciation({
      customerId: customer.id,
      customerPhone: customer.phone,
      orderId: result.order.id,
      now,
      templateId: dto.type === OrderType.CREDIT ? 'thank_you_credit_v1' : 'appreciation_v1',
      dueDate: dto.type === OrderType.CREDIT ? result.dueDate.toLocaleDateString('en-NG') : undefined,
    });

    return {
      success: true,
      data: {
        order_id: result.order.id,
        credit_id: result.creditId,
        total: toDecimalString(result.computed),
        type: dto.type,
      },
    };
  }
}
