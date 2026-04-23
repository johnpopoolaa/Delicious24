import { Injectable, NotFoundException } from '@nestjs/common';
import { ReconciliationTaskStatus } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';
import { SyncBatchDto } from './dto/sync-batch.dto';

const FINANCIAL_TYPES = new Set(['ORDER', 'PAYMENT', 'CREDIT', 'TRANSACTION']);

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async applyBatch(dto: SyncBatchDto) {
    const results: Array<{
      temp_id: string;
      ok: boolean;
      canonical_id?: string;
      error?: string;
      reconciliation_id?: string;
    }> = [];

    for (const ch of dto.changes) {
      const entityType = ch.entity_type.toUpperCase();

      // Financial types → reject and open reconciliation task
      if (FINANCIAL_TYPES.has(entityType)) {
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

      // CUSTOMER: upsert by phone
      if (entityType === 'CUSTOMER') {
        const p = ch.payload as { phone?: string; name?: string; email?: string };
        if (!p.phone || !p.name) {
          results.push({ temp_id: ch.temp_id, ok: false, error: 'INVALID_PAYLOAD' });
          continue;
        }
        const customer = await this.prisma.customer.upsert({
          where: { phone: p.phone },
          create: { phone: p.phone, name: p.name, email: p.email },
          update: { name: p.name, email: p.email },
        });
        results.push({ temp_id: ch.temp_id, ok: true, canonical_id: customer.id });
        continue;
      }

      // MENU_ITEM: name is not unique in schema — use findFirst + create/update
      if (entityType === 'MENU_ITEM') {
        const p = ch.payload as { name?: string; price?: string; in_stock?: boolean };
        if (!p.name || !p.price) {
          results.push({ temp_id: ch.temp_id, ok: false, error: 'INVALID_PAYLOAD' });
          continue;
        }
        const existing = await this.prisma.menuItem.findFirst({ where: { name: p.name } });
        if (existing) {
          const updated = await this.prisma.menuItem.update({
            where: { id: existing.id },
            data: { price: p.price, inStock: p.in_stock ?? true },
          });
          results.push({ temp_id: ch.temp_id, ok: true, canonical_id: String(updated.id) });
        } else {
          const created = await this.prisma.menuItem.create({
            data: { name: p.name, price: p.price, inStock: p.in_stock ?? true },
          });
          results.push({ temp_id: ch.temp_id, ok: true, canonical_id: String(created.id) });
        }
        continue;
      }

      // Unknown entity type
      results.push({ temp_id: ch.temp_id, ok: false, error: 'UNSUPPORTED_ENTITY_TYPE' });
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

  async resolveTask(id: string, status: 'RESOLVED' | 'DISMISSED') {
    try {
      const task = await this.prisma.reconciliationTask.update({
        where: { id },
        data: { status, resolvedAt: new Date() },
      });
      return { success: true, data: task };
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === 'P2025') {
        throw new NotFoundException({ error: 'TASK_NOT_FOUND', message: 'Reconciliation task not found' });
      }
      throw e;
    }
  }
}
