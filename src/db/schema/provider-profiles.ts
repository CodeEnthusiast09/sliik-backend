import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  doublePrecision,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const providerProfiles = pgTable('provider_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  phone: varchar('phone', { length: 20 }),
  bio: text('bio'),
  tradeType: varchar('trade_type', { length: 100 }).notNull(),
  yearsExperience: integer('years_experience').notNull().default(0),
  city: varchar('city', { length: 100 }),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  avgRating: numeric('avg_rating', { precision: 3, scale: 2 })
    .notNull()
    .default('0.00'),
  totalReviews: integer('total_reviews').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
