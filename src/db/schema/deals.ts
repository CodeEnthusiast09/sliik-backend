import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { providerProfiles } from './provider-profiles';
import { services } from './services';

export const sliikDeals = pgTable('sliik_deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id')
    .notNull()
    .references(() => providerProfiles.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  originalPrice: numeric('original_price', {
    precision: 12,
    scale: 2,
  }).notNull(),
  dealPrice: numeric('deal_price', { precision: 12, scale: 2 }).notNull(),
  slotsTotal: integer('slots_total').notNull(),
  slotsRemaining: integer('slots_remaining').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
