import { parseInboundAmount } from './parse-inbound-amount';

describe('parseInboundAmount', () => {
  // ── keyword matching ───────────────────────────────────────────────────────
  describe('keyword detection', () => {
    it('returns null when no payment keyword is present', () => {
      expect(parseInboundAmount('hello boss')).toBeNull();
    });
    it('returns null for "done" with no keyword', () => {
      expect(parseInboundAmount('done')).toBeNull();
    });
    it('returns null when keyword present but no number', () => {
      expect(parseInboundAmount('paid')).toBeNull();
    });
    it('matches "transferred" keyword', () => {
      expect(parseInboundAmount('transferred 5000')).not.toBeNull();
    });
    it('matches "deposited" keyword', () => {
      expect(parseInboundAmount('deposited 5000')).not.toBeNull();
    });
    it('matches "settled" keyword', () => {
      expect(parseInboundAmount('settled 5000')).not.toBeNull();
    });
    it('matches "cleared" keyword', () => {
      expect(parseInboundAmount('cleared 5000')).not.toBeNull();
    });
  });

  // ── plain amounts ─────────────────────────────────────────────────────────
  describe('plain amounts', () => {
    it('"paid 5000" → 5000', () => {
      expect(parseInboundAmount('paid 5000')).toEqual({ amount: '5000' });
    });
    it('"PAID 5,000" → 5000 (thousands separator stripped)', () => {
      expect(parseInboundAmount('PAID 5,000')?.amount).toBe('5000');
    });
    it('"payment of 2000.50" → 2000.50 (raw, no rounding)', () => {
      expect(parseInboundAmount('payment of 2000.50')).toEqual({ amount: '2000.50' });
    });
    it('"deposited 500" → 500 (≥100 taken as-is)', () => {
      expect(parseInboundAmount('deposited 500')).toEqual({ amount: '500' });
    });
    it('embedded: "please note i sent 2000 today" → 2000', () => {
      expect(parseInboundAmount('please note i sent 2000 today')?.amount).toBe('2000');
    });
  });

  // ── k-suffix ──────────────────────────────────────────────────────────────
  describe('k-suffix (×1000)', () => {
    it('"i sent 5k" → 5000', () => {
      expect(parseInboundAmount('i sent 5k')).toEqual({ amount: '5000' });
    });
    it('"transferred 5.5K" → 5500', () => {
      expect(parseInboundAmount('transferred 5.5K')).toEqual({ amount: '5500' });
    });
    it('"paid 10K" → 10000', () => {
      expect(parseInboundAmount('paid 10K')).toEqual({ amount: '10000' });
    });
  });

  // ── 1–99 integers as thousands ────────────────────────────────────────────
  describe('1–99 integers treated as thousands', () => {
    it('"sent 5" → 5000', () => {
      expect(parseInboundAmount('sent 5')).toEqual({ amount: '5000' });
    });
    it('"payment of 50" → 50000', () => {
      expect(parseInboundAmount('payment of 50')).toEqual({ amount: '50000' });
    });
    it('"paid 99" → 99000', () => {
      expect(parseInboundAmount('paid 99')).toEqual({ amount: '99000' });
    });
    it('"paid 100" → 100 (boundary: ≥100 taken as-is)', () => {
      expect(parseInboundAmount('paid 100')).toEqual({ amount: '100' });
    });
  });
});
