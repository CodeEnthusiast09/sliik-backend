import {
  pgTable,
  uuid,
  varchar,
  boolean,
  pgEnum,
  timestamp,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['customer', 'provider']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: roleEnum('role').notNull(),
  googleId: varchar('google_id', { length: 255 }).unique(),
  appleId: varchar('apple_id', { length: 255 }).unique(),
  isEmailVerified: boolean('is_email_verified').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
