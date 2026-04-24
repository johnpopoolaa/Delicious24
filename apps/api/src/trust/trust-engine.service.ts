import { Injectable } from '@nestjs/common';
import { RiskSegment } from '@delicious24/db';
import Decimal from 'decimal.js';
import { WatService } from '../wat/wat.service';

export type TrustDelta = { reason: string; delta: number };

@Injectable()
export class TrustEngineService {
  constructor(private readonly wat: WatService) {}

  segmentForScore(score: number): RiskSegment {
    if (score >= 80) return RiskSegment.VIP;
    if (score >= 50) return RiskSegment.SAFE;
    if (score >= 25) return RiskSegment.RISK;
    return RiskSegment.BANNED;
  }

  clamp(score: number): number {
    return Math.max(0, Math.min(100, score));
  }

  /** Customer paid order in full at sale time (PAID path). */
  outrightPaidSaleDelta(): TrustDelta {
    return { reason: 'OUTRIGHT_PAID_SALE', delta: 8 };
  }

  verifiedReceiptDelta(): TrustDelta {
    return { reason: 'VERIFIED_RECEIPT', delta: 1 };
  }

  chargebackDelta(): TrustDelta {
    return { reason: 'CHARGEBACK', delta: -20 };
  }

  /**
   * Deltas for a payment application against a credit (partial vs full settlement, lateness).
   */
  paymentApplicationDeltas(params: {
    priorBalance: Decimal;
    newBalance: Decimal;
    dueDate: Date;
    paidAt: Date;
  }): TrustDelta[] {
    const { priorBalance, newBalance, dueDate, paidAt } = params;
    const partial = newBalance.gt(0) && newBalance.lt(priorBalance);
    if (partial) {
      return [{ reason: 'PARTIAL_PAYMENT', delta: 2 }];
    }
    if (newBalance.gt(0)) {
      return [];
    }
    const daysLate = this.wat.calendarDaysLate(paidAt, dueDate);
    if (daysLate <= 0) {
      return [{ reason: 'ON_TIME_SETTLEMENT', delta: 8 }];
    }
    if (daysLate >= 1 && daysLate <= 7) {
      return [{ reason: 'LATE_1_7D', delta: -6 }];
    }
    if (daysLate >= 8 && daysLate <= 30) {
      return [{ reason: 'LATE_8_30D', delta: -15 }];
    }
    return [{ reason: 'DEFAULT_GT30D', delta: -35 }];
  }
}
