import { Injectable } from '@nestjs/common';
import { Prisma } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(params: {
    actor: string;
    action: string;
    targetTable: string;
    targetId?: string | null;
    payload: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actor: params.actor,
        action: params.action,
        targetTable: params.targetTable,
        targetId: params.targetId ?? undefined,
        payload: params.payload,
      },
    });
  }

  async list(params: { skip?: number; take?: number }) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: params.skip ?? 0,
      take: Math.min(params.take ?? 50, 200),
    });
  }
}
