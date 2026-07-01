import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  @Roles('customer')
  async createBooking(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBookingDto,
  ) {
    const data = await this.bookingsService.createBooking(user.id, dto);
    return successResponse('Booking created', data);
  }

  @Get()
  @Roles('customer', 'provider')
  async getMyBookings(@CurrentUser() user: AuthUser) {
    const data = await this.bookingsService.getMyBookings(user.id, user.role);
    return successResponse('Bookings fetched', data);
  }

  @Get(':id')
  @Roles('customer', 'provider')
  async getBookingById(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const data = await this.bookingsService.getBookingById(user.id, user.role, id);
    return successResponse('Booking fetched', data);
  }

  @Patch(':id/confirm')
  @Roles('provider')
  async confirmBooking(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const data = await this.bookingsService.confirmBooking(user.id, id);
    return successResponse('Booking confirmed', data);
  }

  @Patch(':id/cancel')
  @Roles('customer', 'provider')
  async cancelBooking(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const data = await this.bookingsService.cancelBooking(user.id, user.role, id);
    return successResponse('Booking cancelled', data);
  }

  @Patch(':id/complete')
  @Roles('provider')
  async completeBooking(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const data = await this.bookingsService.completeBooking(user.id, id);
    return successResponse('Booking completed', data);
  }
}
