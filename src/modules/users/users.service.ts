import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, gt, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcrypt';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import {
  users,
  customerProfiles,
  providerProfiles,
  bookings,
  sliikOffers,
  sliikOfferResponses,
  sliikDeals,
} from '../../db/schema';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private db: Db) {}

  async deleteAccount(userId: string, password?: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user || !user.isActive) {
      throw new NotFoundException('Account not found');
    }

    // Re-confirm the password for password accounts (guards against an accidental
    // or hijacked-session deletion). OAuth-only accounts have no password to check.
    if (user.passwordHash) {
      if (!password) {
        throw new BadRequestException(
          'Password is required to delete your account',
        );
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw new UnauthorizedException('Incorrect password');
    }

    if (user.role === 'customer') {
      const profile = await this.db.query.customerProfiles.findFirst({
        where: eq(customerProfiles.userId, userId),
      });
      if (profile) await this.assertNoCustomerObligations(profile.id);
    } else {
      const profile = await this.db.query.providerProfiles.findFirst({
        where: eq(providerProfiles.userId, userId),
      });
      if (profile) await this.assertNoProviderObligations(profile.id);
    }

    await this.anonymize(user.id, user.role);
    return { deleted: true };
  }

  private async assertNoCustomerObligations(customerProfileId: string) {
    const activeBooking = await this.db.query.bookings.findFirst({
      where: and(
        eq(bookings.customerId, customerProfileId),
        inArray(bookings.status, ['pending', 'confirmed']),
      ),
    });
    if (activeBooking) {
      throw new BadRequestException(
        'You have active bookings. Cancel or complete them before deleting your account.',
      );
    }

    const openOffer = await this.db.query.sliikOffers.findFirst({
      where: and(
        eq(sliikOffers.customerId, customerProfileId),
        eq(sliikOffers.status, 'open'),
      ),
    });
    if (openOffer) {
      throw new BadRequestException(
        'You have open offers. Close them before deleting your account.',
      );
    }
  }

  private async assertNoProviderObligations(providerProfileId: string) {
    const activeBooking = await this.db.query.bookings.findFirst({
      where: and(
        eq(bookings.providerId, providerProfileId),
        inArray(bookings.status, ['pending', 'confirmed']),
      ),
    });
    if (activeBooking) {
      throw new BadRequestException(
        'You have active bookings. Complete or cancel them before deleting your account.',
      );
    }

    const pendingBid = await this.db.query.sliikOfferResponses.findFirst({
      where: and(
        eq(sliikOfferResponses.providerId, providerProfileId),
        eq(sliikOfferResponses.status, 'pending'),
      ),
    });
    if (pendingBid) {
      throw new BadRequestException(
        'You have pending offer bids. Withdraw them before deleting your account.',
      );
    }

    const activeDeal = await this.db.query.sliikDeals.findFirst({
      where: and(
        eq(sliikDeals.providerId, providerProfileId),
        gt(sliikDeals.slotsRemaining, 0),
        gt(sliikDeals.expiresAt, new Date()),
      ),
    });
    if (activeDeal) {
      throw new BadRequestException(
        'You have active deals. Remove them or let them expire before deleting your account.',
      );
    }
  }

  // One-way, irreversible. Scrubs PII in place while keeping every existing join
  // (bookings, reviews, chat) intact and displaying as "Deleted User" to the
  // other party. Denormalized review aggregates are left untouched - they reflect
  // real history the account earned, not current PII.
  private async anonymize(userId: string, role: 'customer' | 'provider') {
    const placeholderEmail = `deleted+${userId}@sliik.deleted`;
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          email: placeholderEmail,
          passwordHash: null,
          googleId: null,
          appleId: null,
          isActive: false,
          deletedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      if (role === 'customer') {
        await tx
          .update(customerProfiles)
          .set({
            fullName: 'Deleted User',
            avatarUrl: null,
            phone: null,
            city: null,
            updatedAt: now,
          })
          .where(eq(customerProfiles.userId, userId));
      } else {
        await tx
          .update(providerProfiles)
          .set({
            fullName: 'Deleted User',
            avatarUrl: null,
            phone: null,
            bio: null,
            city: null,
            latitude: null,
            longitude: null,
            updatedAt: now,
          })
          .where(eq(providerProfiles.userId, userId));
      }
    });
  }
}
