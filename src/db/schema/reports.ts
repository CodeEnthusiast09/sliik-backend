import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { bookings } from './bookings';

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  reportedUserId: uuid('reported_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Kept even if the booking is later removed - the report itself should
  // stay on record for moderation regardless of what happens to the booking.
  bookingId: uuid('booking_id').references(() => bookings.id, {
    onDelete: 'set null',
  }),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
