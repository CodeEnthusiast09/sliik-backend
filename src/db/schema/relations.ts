import { relations } from 'drizzle-orm';
import { users } from './users';
import { customerProfiles } from './customer-profiles';
import { providerProfiles } from './provider-profiles';
import { services } from './services';
import { portfolio } from './portfolio';
import { providerAvailability, providerDaysOff } from './availability';
import { bookings } from './bookings';
import { reviews } from './reviews';
import { sliikOffers, sliikOfferResponses } from './offers';
import { sliikDeals } from './deals';
import { conversations, messages } from './chat';
import { payments } from './payments';
import { notifications } from './notifications';
import { devicePushTokens } from './device-push-tokens';
import { providerPayoutAccounts } from './payouts';
import { favorites } from './favorites';

export const usersRelations = relations(users, ({ one }) => ({
  customerProfile: one(customerProfiles, {
    fields: [users.id],
    references: [customerProfiles.userId],
  }),
  providerProfile: one(providerProfiles, {
    fields: [users.id],
    references: [providerProfiles.userId],
  }),
}));

export const customerProfilesRelations = relations(
  customerProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [customerProfiles.userId],
      references: [users.id],
    }),
    bookings: many(bookings),
    sliikOffers: many(sliikOffers),
  }),
);

export const providerProfilesRelations = relations(
  providerProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [providerProfiles.userId],
      references: [users.id],
    }),
    services: many(services),
    portfolio: many(portfolio),
    availability: many(providerAvailability),
    daysOff: many(providerDaysOff),
    bookings: many(bookings),
    deals: many(sliikDeals),
    offerResponses: many(sliikOfferResponses),
    payoutAccount: one(providerPayoutAccounts, {
      fields: [providerProfiles.id],
      references: [providerPayoutAccounts.providerId],
    }),
  }),
);

export const servicesRelations = relations(services, ({ one }) => ({
  provider: one(providerProfiles, {
    fields: [services.providerId],
    references: [providerProfiles.id],
  }),
}));

export const portfolioRelations = relations(portfolio, ({ one }) => ({
  provider: one(providerProfiles, {
    fields: [portfolio.providerId],
    references: [providerProfiles.id],
  }),
}));

export const providerAvailabilityRelations = relations(
  providerAvailability,
  ({ one }) => ({
    provider: one(providerProfiles, {
      fields: [providerAvailability.providerId],
      references: [providerProfiles.id],
    }),
  }),
);

export const providerDaysOffRelations = relations(
  providerDaysOff,
  ({ one }) => ({
    provider: one(providerProfiles, {
      fields: [providerDaysOff.providerId],
      references: [providerProfiles.id],
    }),
  }),
);

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  customer: one(customerProfiles, {
    fields: [bookings.customerId],
    references: [customerProfiles.id],
  }),
  provider: one(providerProfiles, {
    fields: [bookings.providerId],
    references: [providerProfiles.id],
  }),
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id],
  }),
  deal: one(sliikDeals, {
    fields: [bookings.dealId],
    references: [sliikDeals.id],
  }),
  reviews: many(reviews),
  conversation: one(conversations, {
    fields: [bookings.id],
    references: [conversations.bookingId],
  }),
  payment: one(payments, {
    fields: [bookings.id],
    references: [payments.bookingId],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  booking: one(bookings, {
    fields: [reviews.bookingId],
    references: [bookings.id],
  }),
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
    relationName: 'reviewer',
  }),
  reviewee: one(users, {
    fields: [reviews.revieweeId],
    references: [users.id],
    relationName: 'reviewee',
  }),
}));

export const sliikOffersRelations = relations(sliikOffers, ({ one, many }) => ({
  customer: one(customerProfiles, {
    fields: [sliikOffers.customerId],
    references: [customerProfiles.id],
  }),
  responses: many(sliikOfferResponses),
}));

export const sliikOfferResponsesRelations = relations(
  sliikOfferResponses,
  ({ one }) => ({
    offer: one(sliikOffers, {
      fields: [sliikOfferResponses.offerId],
      references: [sliikOffers.id],
    }),
    provider: one(providerProfiles, {
      fields: [sliikOfferResponses.providerId],
      references: [providerProfiles.id],
    }),
  }),
);

export const sliikDealsRelations = relations(sliikDeals, ({ one }) => ({
  provider: one(providerProfiles, {
    fields: [sliikDeals.providerId],
    references: [providerProfiles.id],
  }),
  service: one(services, {
    fields: [sliikDeals.serviceId],
    references: [services.id],
  }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    booking: one(bookings, {
      fields: [conversations.bookingId],
      references: [bookings.id],
    }),
    messages: many(messages),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const devicePushTokensRelations = relations(
  devicePushTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [devicePushTokens.userId],
      references: [users.id],
    }),
  }),
);

export const providerPayoutAccountsRelations = relations(
  providerPayoutAccounts,
  ({ one }) => ({
    provider: one(providerProfiles, {
      fields: [providerPayoutAccounts.providerId],
      references: [providerProfiles.id],
    }),
  }),
);

export const favoritesRelations = relations(favorites, ({ one }) => ({
  provider: one(providerProfiles, {
    fields: [favorites.providerId],
    references: [providerProfiles.id],
  }),
}));
