import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, avg, count, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { bookings, reviews } from '../../db/schema';
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

    const [review] = await this.db
      .insert(reviews)
      .values({
        bookingId: dto.bookingId,
        reviewerId: userId,
        revieweeId,
        rating: dto.rating,
        comment: dto.comment,
      })
      .returning();

    return review;
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

    return {
      averageRating: stats.average ? Number(stats.average) : null,
      totalReviews: Number(stats.total),
      reviews: list,
    };
  }

  async getMyReviews(userId: string) {
    return this.db.query.reviews.findMany({
      where: eq(reviews.reviewerId, userId),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
  }
}
