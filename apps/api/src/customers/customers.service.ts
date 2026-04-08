import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreditStatus, Prisma } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';
import { money, toDecimalString } from '../common/money.util';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async createCustomer(dto: { name: string; phone: string; email?: string }) {
    try {
      const customer = await this.prisma.customer.create({
        data: { name: dto.name, phone: dto.phone, email: dto.email },
      });
      return { success: true, data: customer };
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === 'P2002') {
        throw new ConflictException({ error: 'PHONE_ALREADY_EXISTS', message: 'A customer with this phone number already exists' });
      }
      throw e;
    }
  }

  async updateCustomer(id: string, dto: { name?: string; phone?: string; email?: string }) {
    try {
      const customer = await this.prisma.customer.update({
        where: { id },
        data: { name: dto.name, phone: dto.phone, email: dto.email },
      });
      return { success: true, data: customer };
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === 'P2002') {
        throw new ConflictException({ error: 'PHONE_ALREADY_EXISTS', message: 'A customer with this phone number already exists' });
      }
      if (err?.code === 'P2025') {
        throw new NotFoundException({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
      }
      throw e;
    }
  }

  async search(q: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const term = q.trim();
    if (!term) {
      return { success: true, data: { items: [], page, limit, total: 0 } };
    }
    const where: Prisma.CustomerWhereInput = {
      OR: [
        { phone: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ],
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
    ]);
    return { success: true, data: { items, page, limit, total } };
  }

  async ledger(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        credits: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!customer) {
      throw new NotFoundException({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
    }
    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [{ order: { customerId } }, { credit: { customerId } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { order: true, credit: true },
    });
    let openCredit = money(0);
    for (const c of customer.credits) {
      if (c.status === CreditStatus.ACTIVE || c.status === CreditStatus.PENDING_VERIFICATION) {
        openCredit = openCredit.add(c.balance.toString());
      }
    }
    const running = openCredit.add(customer.storeCreditBalance.toString());
    return {
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          trust_score: customer.trustScore,
          risk_segment: customer.riskSegment,
          store_credit_balance: customer.storeCreditBalance.toString(),
        },
        credits: customer.credits,
        transactions,
        running_balance: toDecimalString(running),
      },
    };
  }

  async ledgerCsv(customerId: string) {
    const res = await this.ledger(customerId);
    const lines = ['kind,amount,note,created_at,credit_id,order_id'];
    for (const t of res.data.transactions) {
      lines.push(
        [
          t.kind,
          t.amount.toString(),
          (t.note ?? '').replace(/,/g, ';'),
          t.createdAt.toISOString(),
          t.creditId ?? '',
          t.orderId ?? '',
        ].join(','),
      );
    }
    return lines.join('\n');
  }
}
