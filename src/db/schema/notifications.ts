import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const notificationTypeEnum = pgEnum('notification_type', [
  'booking_created',
  'booking_confirmed',
  'booking_declined',
  'booking_cancelled',
  'booking_completed',
  'booking_reminder',
  'offer_posted',
  'offer_response_received',
  'offer_accepted',
  'deal_posted',
  'deal_claimed',
  'payment_received',
  'payment_sent',
  'review_received',
  'message_received',
  'system',
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: jsonb('data'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
