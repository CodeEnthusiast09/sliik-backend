import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { customerProfiles } from './customer-profiles';
import { providerProfiles } from './provider-profiles';

export const offerStatusEnum = pgEnum('offer_status', [
  'open',
  'accepted',
  'expired',
  'cancelled',
]);

export const offerResponseStatusEnum = pgEnum('offer_response_status', [
  'pending',
  'accepted',
  'declined',
]);

export const sliikOffers = pgTable('sliik_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customerProfiles.id, { onDelete: 'cascade' }),
  serviceType: varchar('service_type', { length: 100 }).notNull(),
  description: text('description').notNull(),
  budget: numeric('budget', { precision: 12, scale: 2 }),
  preferredFrom: timestamp('preferred_from', { withTimezone: true }).notNull(),
  preferredTo: timestamp('preferred_to', { withTimezone: true }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  status: offerStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sliikOfferResponses = pgTable('sliik_offer_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  offerId: uuid('offer_id')
    .notNull()
    .references(() => sliikOffers.id, { onDelete: 'cascade' }),
  providerId: uuid('provider_id')
    .notNull()
    .references(() => providerProfiles.id, { onDelete: 'cascade' }),
  offeredPrice: numeric('offered_price', { precision: 12, scale: 2 }).notNull(),
  message: text('message'),
  status: offerResponseStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
