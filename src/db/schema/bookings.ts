import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { customerProfiles } from './customer-profiles';
import { providerProfiles } from './provider-profiles';
import { services } from './services';
import { sliikDeals } from './deals';

export const bookingStatusEnum = pgEnum('booking_status', [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'declined',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'unpaid',
  'paid',
  'refunded',
]);

export const paymentProviderEnum = pgEnum('payment_provider', ['paystack']);

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customerProfiles.id, { onDelete: 'restrict' }),
  providerId: uuid('provider_id')
    .notNull()
    .references(() => providerProfiles.id, { onDelete: 'restrict' }),
  serviceId: uuid('service_id').references(() => services.id, {
    onDelete: 'restrict',
  }),
  // Nullable - only set when this booking came from claiming a Sliik Deal.
  // 'set null' (not 'restrict') so a provider can still delete a deal that
  // already has claims without being blocked by its resulting bookings.
  dealId: uuid('deal_id').references(() => sliikDeals.id, {
    onDelete: 'set null',
  }),
  status: bookingStatusEnum('status').notNull().default('pending'),
  scheduledAt: timestamp('scheduled_at').notNull(),
  notes: text('notes'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paymentStatus: paymentStatusEnum('payment_status')
    .notNull()
    .default('unpaid'),
  paymentProvider: paymentProviderEnum('payment_provider'),
  paymentReference: text('payment_reference'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
