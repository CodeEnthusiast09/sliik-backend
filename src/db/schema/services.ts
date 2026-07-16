import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { providerProfiles } from './provider-profiles';

// Shared between services and portfolio (see portfolio.ts) - defined here
// since services is the primary owner of "category" as a concept.
export const categoryEnum = pgEnum('category', [
  'hair',
  'braids',
  'wig_install',
  'makeup',
  'lashes',
  'nails',
  'barbering',
  'mens_grooming',
]);

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id')
    .notNull()
    .references(() => providerProfiles.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  category: categoryEnum('category'),
  imageUrl: varchar('image_url', { length: 500 }),
  addOns: text('add_ons').array(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
