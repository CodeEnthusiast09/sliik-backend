import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { providerProfiles } from './provider-profiles';

export const providerPayoutAccounts = pgTable('provider_payout_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id')
    .notNull()
    .unique()
    .references(() => providerProfiles.id, { onDelete: 'cascade' }),
  paystackSubaccountCode: varchar('paystack_subaccount_code', {
    length: 100,
  }).notNull(),
  bankCode: varchar('bank_code', { length: 20 }).notNull(),
  accountNumber: varchar('account_number', { length: 20 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
