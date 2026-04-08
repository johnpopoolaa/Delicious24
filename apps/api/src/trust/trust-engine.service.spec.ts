import { TrustEngineService } from './trust-engine.service';
import { WatService } from '../wat/wat.service';
import { RiskSegment } from '@delicious24/db';
import Decimal from 'decimal.js';

describe('TrustEngineService', () => {
  let service: TrustEngineService;

  beforeEach(() => {
    service = new TrustEngineService(new WatService());
  });

  // ── segmentForScore ────────────────────────────────────────────────────────
  describe('segmentForScore', () => {
    it('returns VIP for score 85', () => expect(service.segmentForScore(85)).toBe(RiskSegment.VIP));
    it('returns VIP for score 100', () => expect(service.segmentForScore(100)).toBe(RiskSegment.VIP));
    it('returns SAFE for score 84', () => expect(service.segmentForScore(84)).toBe(RiskSegment.SAFE));
    it('returns SAFE for score 65', () => expect(service.segmentForScore(65)).toBe(RiskSegment.SAFE));
    it('returns RISK for score 64', () => expect(service.segmentForScore(64)).toBe(RiskSegment.RISK));
    it('returns RISK for score 40', () => expect(service.segmentForScore(40)).toBe(RiskSegment.RISK));
    it('returns BANNED for score 39', () => expect(service.segmentForScore(39)).toBe(RiskSegment.BANNED));
    it('returns BANNED for score 0', () => expect(service.segmentForScore(0)).toBe(RiskSegment.BANNED));
  });

  // ── clamp ─────────────────────────────────────────────────────────────────
  describe('clamp', () => {
    it('clamps to 0 for negative input', () => expect(service.clamp(-10)).toBe(0));
    it('clamps to 100 for input over 100', () => expect(service.clamp(110)).toBe(100));
    it('keeps value unchanged when in range', () => expect(service.clamp(50)).toBe(50));
    it('keeps boundary 0', () => expect(service.clamp(0)).toBe(0));
    it('keeps boundary 100', () => expect(service.clamp(100)).toBe(100));
  });

  // ── outrightPaidSaleDelta ─────────────────────────────────────────────────
  describe('outrightPaidSaleDelta', () => {
    it('returns +8 for outright paid sale', () => {
      const d = service.outrightPaidSaleDelta();
      expect(d.delta).toBe(8);
      expect(d.reason).toBe('OUTRIGHT_PAID_SALE');
    });
  });

  // ── chargebackDelta ───────────────────────────────────────────────────────
  describe('chargebackDelta', () => {
    it('returns -20', () => {
      const d = service.chargebackDelta();
      expect(d.delta).toBe(-20);
      expect(d.reason).toBe('CHARGEBACK');
    });
  });

  // ── verifiedReceiptDelta ──────────────────────────────────────────────────
  describe('verifiedReceiptDelta', () => {
    it('returns +1', () => {
      const d = service.verifiedReceiptDelta();
      expect(d.delta).toBe(1);
    });
  });

  // ── paymentApplicationDeltas ──────────────────────────────────────────────
  describe('paymentApplicationDeltas', () => {
    // due date: 2026-04-10 noon UTC (1pm WAT)
    const dueDate = new Date('2026-04-10T12:00:00.000Z');
    const priorBalance = new Decimal('5000');
    const zeroed = new Decimal('0');

    it('on-time full settlement → +8', () => {
      const deltas = service.paymentApplicationDeltas({
        priorBalance,
        newBalance: zeroed,
        dueDate,
        paidAt: new Date('2026-04-09T10:00:00.000Z'), // 1 day before due
      });
      expect(deltas).toHaveLength(1);
      expect(deltas[0].delta).toBe(8);
      expect(deltas[0].reason).toBe('ON_TIME_SETTLEMENT');
    });

    it('partial payment (balance not zeroed) → +2', () => {
      const deltas = service.paymentApplicationDeltas({
        priorBalance,
        newBalance: new Decimal('2000'), // still has 2000 balance
        dueDate,
        paidAt: new Date('2026-04-09T10:00:00.000Z'),
      });
      expect(deltas).toHaveLength(1);
      expect(deltas[0].delta).toBe(2);
      expect(deltas[0].reason).toBe('PARTIAL_PAYMENT');
    });

    it('no delta when balance unchanged', () => {
      const deltas = service.paymentApplicationDeltas({
        priorBalance,
        newBalance: priorBalance, // nothing paid
        dueDate,
        paidAt: new Date('2026-04-09T10:00:00.000Z'),
      });
      expect(deltas).toHaveLength(0);
    });

    it('late 1–7 days → −6', () => {
      const deltas = service.paymentApplicationDeltas({
        priorBalance,
        newBalance: zeroed,
        dueDate,
        paidAt: new Date('2026-04-13T10:00:00.000Z'), // 3 days late
      });
      expect(deltas[0].delta).toBe(-6);
      expect(deltas[0].reason).toBe('LATE_1_7D');
    });

    it('late 8–30 days → −15', () => {
      const deltas = service.paymentApplicationDeltas({
        priorBalance,
        newBalance: zeroed,
        dueDate,
        paidAt: new Date('2026-04-25T10:00:00.000Z'), // 15 days late
      });
      expect(deltas[0].delta).toBe(-15);
      expect(deltas[0].reason).toBe('LATE_8_30D');
    });

    it('default >30 days → −35', () => {
      const deltas = service.paymentApplicationDeltas({
        priorBalance,
        newBalance: zeroed,
        dueDate,
        paidAt: new Date('2026-05-15T10:00:00.000Z'), // 35 days late
      });
      expect(deltas[0].delta).toBe(-35);
      expect(deltas[0].reason).toBe('DEFAULT_GT30D');
    });
  });
});
