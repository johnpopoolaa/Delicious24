import { Injectable } from '@nestjs/common';
import { CreditStatus, PendingPaymentCandidateStatus } from '@delicious24/db';
import { PrismaService } from '../prisma/prisma.service';
import { parsePaidAmount } from '../common/parse-inbound-paid';
import { InboundWebhookDto } from './dto/inbound-webhook.dto';

@Injectable()
export class WebhookService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePhone(raw: string): string {
    return raw.trim().replace(/\s+/g, '');
  }

  async handleInbound(dto: InboundWebhookDto) {
    const phone = this.normalizePhone(dto.from_phone);
    const parsed = parsePaidAmount(dto.message_text);
    const candidate = await this.prisma.pendingPaymentCandidate.create({
      data: {
        fromPhone: phone,
        parsedAmount: parsed ? parsed.amount : undefined,
        rawText: dto.message_text,
        status: PendingPaymentCandidateStatus.NEW,
      },
    });

    if (parsed) {
      const customer = await this.prisma.customer.findFirst({
        where: { phone },
      });
      if (customer) {
        const oldest = await this.prisma.credit.findFirst({
          where: {
            customerId: customer.id,
            status: CreditStatus.ACTIVE,
          },
          orderBy: { createdAt: 'asc' },
        });
        if (oldest) {
          await this.prisma.pendingPaymentCandidate.update({
            where: { id: candidate.id },
            data: { matchedCreditId: oldest.id },
          });
        }
      }
    }

    const updated = await this.prisma.pendingPaymentCandidate.findUnique({ where: { id: candidate.id } });
    return {
      success: true,
      data: {
        id: updated!.id,
        from_phone: updated!.fromPhone,
        parsed_amount: updated!.parsedAmount?.toString() ?? null,
        matched_credit_id: updated!.matchedCreditId,
        status: updated!.status,
      },
    };
  }
}
