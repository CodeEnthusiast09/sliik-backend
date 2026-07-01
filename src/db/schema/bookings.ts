import { pgTable, uuid, text, numeric, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { customerProfiles } from './customer-profiles';
import { providerProfiles } from './provider-profiles';
import { services } from './services';

export const bookingStatusEnum = pgEnum('booking_status', [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'unpaid',
  'paid',
  'refunded',
]);

export const paymentProviderEnum = pgEnum('payment_provider', [
  'stripe',
  'paystack',
]);

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customerProfiles.id, { onDelete: 'restrict' }),
  providerId: uuid('provider_id').notNull().references(() => providerProfiles.id, { onDelete: 'restrict' }),
  serviceId: uuid('service_id').references(() => services.id, { onDelete: 'restrict' }),
  status: bookingStatusEnum('status').notNull().default('pending'),
  scheduledAt: timestamp('scheduled_at').notNull(),
  notes: text('notes'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('unpaid'),
  paymentProvider: paymentProviderEnum('payment_provider'),
  paymentReference: text('payment_reference'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
