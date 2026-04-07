import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ReconciliationTaskStatus } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';
import { SyncBatchDto } from './dto/sync-batch.dto';

const FINANCIAL_TYPES = new Set(['ORDER', 'PAYMENT', 'CREDIT', 'TRANSACTION']);

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Non-financial changes: last-write-wins on server (skeleton returns stable canonical IDs).
   * Financial changes: reject and open a reconciliation task for admin.
   */
  async applyBatch(dto: SyncBatchDto) {
    const results: Array<{
      temp_id: string;
      ok: boolean;
      canonical_id?: string;
      error?: string;
      reconciliation_id?: string;
    }> = [];

    for (const ch of dto.changes) {
      if (FINANCIAL_TYPES.has(ch.entity_type.toUpperCase())) {
        const task = await this.prisma.reconciliationTask.create({
          data: {
            clientId: dto.client_id,
            entityType: ch.entity_type,
            payload: { temp_id: ch.temp_id, ...ch.payload } as object,
            status: ReconciliationTaskStatus.OPEN,
          },
        });
        results.push({
          temp_id: ch.temp_id,
          ok: false,
          error: 'FINANCIAL_CONFLICT',
          reconciliation_id: task.id,
        });
        continue;
      }

      results.push({
        temp_id: ch.temp_id,
        ok: true,
        canonical_id: randomUUID(),
      });
    }

    return { success: true, data: { results } };
  }

  async listReconciliation(status?: ReconciliationTaskStatus) {
    return this.prisma.reconciliationTask.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
