import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { providerProfiles } from './provider-profiles';

export const portfolio = pgTable('portfolio', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').notNull().references(() => providerProfiles.id, { onDelete: 'cascade' }),
  imageUrl: varchar('image_url', { length: 500 }).notNull(),
  caption: text('caption'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
