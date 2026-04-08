import { WatService } from './wat.service';

describe('WatService', () => {
  let service: WatService;

  beforeEach(() => {
    service = new WatService();
  });

  // ── courtesyReminderAt ────────────────────────────────────────────────────
  describe('courtesyReminderAt', () => {
    it('fires one day BEFORE the due date at 09:00 WAT', () => {
      // due date: 2026-04-10 (any time UTC)
      const dueDate = new Date('2026-04-10T15:00:00.000Z');
      const result = service.courtesyReminderAt(dueDate);
      // Expected: 2026-04-09 09:00 WAT = 2026-04-09T08:00:00.000Z
      expect(result.toISOString()).toBe('2026-04-09T08:00:00.000Z');
    });

    it('handles due date at midnight WAT without shifting the calendar day', () => {
      // 2026-04-10 00:00 WAT = 2026-04-09T23:00:00.000Z UTC
      const dueDate = new Date('2026-04-09T23:00:00.000Z');
      const result = service.courtesyReminderAt(dueDate);
      // Day before 2026-04-10 WAT is 2026-04-09 WAT at 09:00
      expect(result.toISOString()).toBe('2026-04-09T08:00:00.000Z');
    });
  });

  // ── urgentReminderAt ──────────────────────────────────────────────────────
  describe('urgentReminderAt', () => {
    it('fires ON the due date at 09:00 WAT', () => {
      const dueDate = new Date('2026-04-10T15:00:00.000Z');
      const result = service.urgentReminderAt(dueDate);
      // Expected: 2026-04-10 09:00 WAT = 2026-04-10T08:00:00.000Z
      expect(result.toISOString()).toBe('2026-04-10T08:00:00.000Z');
    });
  });

  // ── overdueReminderAt ─────────────────────────────────────────────────────
  describe('overdueReminderAt', () => {
    it('fires one day AFTER the due date at 09:00 WAT', () => {
      const dueDate = new Date('2026-04-10T15:00:00.000Z');
      const result = service.overdueReminderAt(dueDate);
      // Expected: 2026-04-11 09:00 WAT = 2026-04-11T08:00:00.000Z
      expect(result.toISOString()).toBe('2026-04-11T08:00:00.000Z');
    });
  });

  // ── calendarDaysLate ──────────────────────────────────────────────────────
  describe('calendarDaysLate', () => {
    const dueDate = new Date('2026-04-10T12:00:00.000Z');

    it('returns 0 when paid on the due date', () => {
      const paidAt = new Date('2026-04-10T14:00:00.000Z');
      expect(service.calendarDaysLate(paidAt, dueDate)).toBe(0);
    });

    it('returns negative when paid before due date', () => {
      const paidAt = new Date('2026-04-08T10:00:00.000Z');
      expect(service.calendarDaysLate(paidAt, dueDate)).toBeLessThan(0);
    });

    it('returns 3 when paid 3 calendar days late', () => {
      const paidAt = new Date('2026-04-13T10:00:00.000Z');
      expect(service.calendarDaysLate(paidAt, dueDate)).toBe(3);
    });

    it('returns 35 when paid 35 days late', () => {
      const paidAt = new Date('2026-05-15T10:00:00.000Z');
      expect(service.calendarDaysLate(paidAt, dueDate)).toBe(35);
    });
  });

  // ── appreciationSendAt ────────────────────────────────────────────────────
  describe('appreciationSendAt', () => {
    it('fires 2 minutes after the given time', () => {
      const now = new Date('2026-04-10T10:00:00.000Z');
      const result = service.appreciationSendAt(now);
      expect(result.getTime() - now.getTime()).toBe(2 * 60 * 1000);
    });
  });
});
