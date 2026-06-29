import { pgTable, uuid, numeric, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { bookings } from './bookings';

export const paymentTxStatusEnum = pgEnum('payment_tx_status', [
  'pending',
  'success',
  'failed',
  'refunded',
]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('NGN'),
  provider: varchar('provider', { length: 20 }).notNull(),
  reference: varchar('reference', { length: 255 }).notNull().unique(),
  status: paymentTxStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
