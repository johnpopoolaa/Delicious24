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

  /** Day before due date at 09:00 WAT. */
  courtesyReminderAt(dueDate: Date): Date {
    const dueWat = toZonedTime(dueDate, WAT_TZ);
    const dayBefore = addDays(dueWat, -1);
    const atNine = setMilliseconds(setSeconds(setMinutes(setHours(dayBefore, 9), 0), 0), 0);
    return fromZonedTime(atNine, WAT_TZ);
  }

  /** Due date itself at 09:00 WAT. */
  urgentReminderAt(dueDate: Date): Date {
    const dueWat = toZonedTime(dueDate, WAT_TZ);
    const atNine = setMilliseconds(setSeconds(setMinutes(setHours(dueWat, 9), 0), 0), 0);
    return fromZonedTime(atNine, WAT_TZ);
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
