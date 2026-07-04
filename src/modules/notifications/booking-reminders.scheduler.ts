import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { bookings } from '../../db/schema';
import { NotificationsService } from './notifications.service';

type Db = NodePgDatabase<typeof schema>;

const REMINDER_WINDOWS = [
  { hoursAhead: 24, column: 'remindedAt24h', label: '24 hours' },
  { hoursAhead: 2, column: 'remindedAt2h', label: '2 hours' },
] as const;

@Injectable()
export class BookingRemindersScheduler {
  constructor(
    @Inject(DRIZZLE) private db: Db,
    private notificationsService: NotificationsService,
  ) {}

  // Runs frequently enough that a booking crossing a reminder threshold is
  // never more than 15 minutes late - remindedAtXh dedupes so a missed or
  // re-run tick never sends the same reminder twice.
  @Cron('0 */15 * * * *')
  async sendDueReminders() {
    for (const window of REMINDER_WINDOWS) {
      await this.sendWindow(window.hoursAhead, window.column, window.label);
    }
  }

  private async sendWindow(
    hoursAhead: number,
    remindedColumn: 'remindedAt24h' | 'remindedAt2h',
    label: string,
  ) {
    const now = new Date();
    const threshold = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const due = await this.db.query.bookings.findMany({
      where: and(
        eq(bookings.status, 'confirmed'),
        isNull(bookings[remindedColumn]),
        gt(bookings.scheduledAt, now),
        lte(bookings.scheduledAt, threshold),
      ),
      with: { customer: true, provider: true, service: true },
    });

    for (const booking of due) {
      const serviceName = booking.service?.name ?? 'appointment';
      await this.notificationsService.create(
        booking.customer.userId,
        'booking_reminder',
        'Upcoming appointment',
        `Reminder: your ${serviceName} with ${booking.provider.fullName} is in ${label}`,
        { bookingId: booking.id },
      );
      await this.notificationsService.create(
        booking.provider.userId,
        'booking_reminder',
        'Upcoming appointment',
        `Reminder: your ${serviceName} with ${booking.customer.fullName} is in ${label}`,
        { bookingId: booking.id },
      );

      await this.db
        .update(bookings)
        .set({ [remindedColumn]: new Date() })
        .where(eq(bookings.id, booking.id));
    }
  }
}
