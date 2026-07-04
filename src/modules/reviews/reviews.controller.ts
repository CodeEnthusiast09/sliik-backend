import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';

@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  @Roles('customer', 'provider')
  async createReview(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReviewDto,
  ) {
    const data = await this.reviewsService.createReview(user.id, dto);
    return successResponse('Review submitted', data);
  }

  @Get('mine')
  @Roles('customer', 'provider')
  async getMyReviews(@CurrentUser() user: AuthUser) {
    const data = await this.reviewsService.getMyReviews(user.id);
    return successResponse('Your reviews fetched', data);
  }

  @Get('booking/:bookingId')
  @Roles('customer', 'provider')
  async getReviewsForBooking(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
  ) {
    const data = await this.reviewsService.getReviewsForBooking(
      user.id,
      bookingId,
    );
    return successResponse('Reviews fetched', data);
  }

  @Get('user/:userId')
  @Roles('customer', 'provider')
  async getReviewsForUser(@Param('userId') userId: string) {
    const data = await this.reviewsService.getReviewsForUser(userId);
    return successResponse('Reviews fetched', data);
  }
}
