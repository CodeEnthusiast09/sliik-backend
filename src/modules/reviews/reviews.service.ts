import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, avg, count, eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { bookings, customerProfiles, providerProfiles, reviews } from '../../db/schema';
import { CreateReviewDto } from './dto/create-review.dto';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class ReviewsService {
  constructor(@Inject(DRIZZLE) private db: Db) {}

  async createReview(userId: string, dto: CreateReviewDto) {
    const booking = await this.db.query.bookings.findFirst({
      where: eq(bookings.id, dto.bookingId),
      with: { customer: true, provider: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'completed') {
      throw new BadRequestException('Can only review a completed booking');
    }

    let revieweeId: string;
    if (booking.customer.userId === userId) {
      revieweeId = booking.provider.userId;
    } else if (booking.provider.userId === userId) {
      revieweeId = booking.customer.userId;
    } else {
      throw new ForbiddenException('You are not a participant of this booking');
    }

    const existing = await this.db.query.reviews.findFirst({
      where: and(eq(reviews.bookingId, dto.bookingId), eq(reviews.reviewerId, userId)),
    });
    if (existing) throw new BadRequestException('You have already reviewed this booking');

    return this.db.transaction(async (tx) => {
      const [review] = await tx
        .insert(reviews)
        .values({
          bookingId: dto.bookingId,
          reviewerId: userId,
          revieweeId,
          rating: dto.rating,
          comment: dto.comment,
        })
        .returning();

      // Only providers have a denormalized avgRating/totalReviews used for
      // discovery search/filter and the profile header - customers have no
      // equivalent public column, so a provider-reviewing-customer review
      // has nothing further to update here.
      const revieweeProvider = await tx.query.providerProfiles.findFirst({
        where: eq(providerProfiles.userId, revieweeId),
      });
      if (revieweeProvider) {
        const [stats] = await tx
          .select({ average: avg(reviews.rating), total: count(reviews.id) })
          .from(reviews)
          .where(eq(reviews.revieweeId, revieweeId));

        await tx
          .update(providerProfiles)
          .set({
            avgRating: stats.average ?? '0.00',
            totalReviews: Number(stats.total),
            updatedAt: new Date(),
          })
          .where(eq(providerProfiles.id, revieweeProvider.id));
      }

      return review;
    });
  }

  async getReviewsForBooking(userId: string, bookingId: string) {
    const booking = await this.db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: { customer: true, provider: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customer.userId !== userId && booking.provider.userId !== userId) {
      throw new ForbiddenException('You are not a participant of this booking');
    }

    return this.db.query.reviews.findMany({
      where: eq(reviews.bookingId, bookingId),
    });
  }

  async getReviewsForUser(userId: string) {
    const [stats] = await this.db
      .select({ average: avg(reviews.rating), total: count(reviews.id) })
      .from(reviews)
      .where(eq(reviews.revieweeId, userId));

    const list = await this.db.query.reviews.findMany({
      where: eq(reviews.revieweeId, userId),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });

    // The reviewer's display name/avatar lives on customer_profiles or
    // provider_profiles (whichever matches their role), never on `users`
    // itself - look both up and merge, since a reviewer could be either.
    const reviewerIds = [...new Set(list.map((review) => review.reviewerId))];
    const [reviewerCustomers, reviewerProviders] = reviewerIds.length
      ? await Promise.all([
          this.db.query.customerProfiles.findMany({
            where: inArray(customerProfiles.userId, reviewerIds),
          }),
          this.db.query.providerProfiles.findMany({
            where: inArray(providerProfiles.userId, reviewerIds),
          }),
        ])
      : [[], []];

    const reviewerById = new Map<string, { fullName: string; avatarUrl: string | null }>();
    for (const profile of [...reviewerCustomers, ...reviewerProviders]) {
      reviewerById.set(profile.userId, { fullName: profile.fullName, avatarUrl: profile.avatarUrl });
    }

    return {
      averageRating: stats.average ? Number(stats.average) : null,
      totalReviews: Number(stats.total),
      reviews: list.map((review) => ({
        ...review,
        reviewer: reviewerById.get(review.reviewerId) ?? null,
      })),
    };
  }

  async getMyReviews(userId: string) {
    return this.db.query.reviews.findMany({
      where: eq(reviews.reviewerId, userId),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
  }
}
