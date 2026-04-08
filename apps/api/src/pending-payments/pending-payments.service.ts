import { Injectable, NotFoundException } from '@nestjs/common';
import { PendingPaymentCandidateStatus } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PendingPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    status?: PendingPaymentCandidateStatus;
    from_phone?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.from_phone ? { fromPhone: { contains: params.from_phone, mode: 'insensitive' as const } } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.pendingPaymentCandidate.count({ where }),
      this.prisma.pendingPaymentCandidate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { matchedCredit: { include: { customer: true } } },
      }),
    ]);

    return { success: true, data: { items, total, page, limit } };
  }

  async updateStatus(id: string, status: PendingPaymentCandidateStatus) {
    try {
      const updated = await this.prisma.pendingPaymentCandidate.update({
        where: { id },
        data: { status },
      });
      return { success: true, data: updated };
    } catch {
      throw new NotFoundException({ error: 'CANDIDATE_NOT_FOUND', message: 'Pending payment candidate not found' });
    }
  }
}
