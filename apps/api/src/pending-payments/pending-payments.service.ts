import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PendingPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.pendingPaymentCandidate.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
