import { pgTable, uuid, integer, time, date, varchar, timestamp } from 'drizzle-orm/pg-core';
import { providerProfiles } from './provider-profiles';

export const providerAvailability = pgTable('provider_availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').notNull().references(() => providerProfiles.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
});

export const providerDaysOff = pgTable('provider_days_off', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').notNull().references(() => providerProfiles.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  reason: varchar('reason', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
