import { Injectable } from '@nestjs/common';
import { addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/** All business timestamps are interpreted in Africa/Lagos (WAT). */
export const WAT_TZ = 'Africa/Lagos';

@Injectable()
export class WatService {
  /** “Now” as an instant; convert to WAT wall clock when scheduling. */
  nowUtc(): Date {
    return new Date();
  }

  /** Next calendar day in WAT at 09:00 local (stored as UTC instant). */
  courtesyReminderAt(fromUtc: Date): Date {
    const z = toZonedTime(fromUtc, WAT_TZ);
    const next = addDays(z, 1);
    const atNine = setMilliseconds(setSeconds(setMinutes(setHours(next, 9), 0), 0), 0);
    return fromZonedTime(atNine, WAT_TZ);
  }

  /** Two days before due date, 09:00 WAT (or ASAP if already past). */
  urgentReminderAt(dueDateUtc: Date, fromUtc: Date): Date {
    const dueWat = toZonedTime(dueDateUtc, WAT_TZ);
    let target = addDays(dueWat, -2);
    target = setMilliseconds(setSeconds(setMinutes(setHours(target, 9), 0), 0), 0);
    const inst = fromZonedTime(target, WAT_TZ);
    return inst < fromUtc ? fromUtc : inst;
  }

  /** Day after due, 09:00 WAT. */
  overdueReminderAt(dueDateUtc: Date): Date {
    const dueWat = toZonedTime(dueDateUtc, WAT_TZ);
    const next = addDays(dueWat, 1);
    const atNine = setMilliseconds(setSeconds(setMinutes(setHours(next, 9), 0), 0), 0);
    return fromZonedTime(atNine, WAT_TZ);
  }

  /** Appreciation SMS/email shortly after outright payment (e.g. +2 minutes). */
  appreciationSendAt(fromUtc: Date): Date {
    return new Date(fromUtc.getTime() + 2 * 60 * 1000);
  }

  calendarDaysLate(paidAtUtc: Date, dueDateUtc: Date): number {
    const p = toZonedTime(paidAtUtc, WAT_TZ);
    const d = toZonedTime(dueDateUtc, WAT_TZ);
    const start = Date.UTC(p.getFullYear(), p.getMonth(), p.getDate());
    const end = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((start - end) / 86400000);
  }
}
