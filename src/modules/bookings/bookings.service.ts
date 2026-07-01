import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import {
  bookings,
  customerProfiles,
  providerProfiles,
  services,
} from '../../db/schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PayoutsService } from '../payouts/payouts.service';

type Db = NodePgDatabase<typeof schema>;
type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DRIZZLE) private db: Db,
    private payoutsService: PayoutsService,
  ) {}

  private async getCustomerProfile(userId: string) {
    const profile = await this.db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Customer profile not found');
    return profile;
  }

  private async getProviderProfile(userId: string) {
    const profile = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Provider profile not found');
    return profile;
  }

  private async getBookingOrThrow(bookingId: string) {
    const booking = await this.db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        service: true,
        customer: true,
        provider: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private assertStatus(
    booking: { status: BookingStatus },
    allowed: BookingStatus[],
  ) {
    if (!allowed.includes(booking.status)) {
      throw new BadRequestException(
        `Cannot perform this action on a booking with status "${booking.status}"`,
      );
    }
  }

  async createBooking(userId: string, dto: CreateBookingDto) {
    const customer = await this.getCustomerProfile(userId);

    const provider = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.id, dto.providerId),
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const service = await this.db.query.services.findFirst({
      where: and(
        eq(services.id, dto.serviceId),
        eq(services.providerId, dto.providerId),
        eq(services.isActive, true),
      ),
    });
    if (!service)
      throw new NotFoundException('Service not found or not available');

    await this.payoutsService.assertProviderPayable(provider.id);

    const [booking] = await this.db
      .insert(bookings)
      .values({
        customerId: customer.id,
        providerId: provider.id,
        serviceId: service.id,
        scheduledAt: new Date(dto.scheduledAt),
        notes: dto.notes,
        totalAmount: service.price,
      })
      .returning();

    return booking;
  }

  async getMyBookings(userId: string, role: string) {
    if (role === 'customer') {
      const customer = await this.getCustomerProfile(userId);
      return this.db.query.bookings.findMany({
        where: eq(bookings.customerId, customer.id),
        with: { service: true, provider: true },
        orderBy: (b, { desc }) => [desc(b.createdAt)],
      });
    }

    const provider = await this.getProviderProfile(userId);
    return this.db.query.bookings.findMany({
      where: eq(bookings.providerId, provider.id),
      with: { service: true, customer: true },
      orderBy: (b, { desc }) => [desc(b.createdAt)],
    });
  }

  async getBookingById(userId: string, role: string, bookingId: string) {
    const booking = await this.getBookingOrThrow(bookingId);

    const isOwner =
      (role === 'customer' && booking.customer.userId === userId) ||
      (role === 'provider' && booking.provider.userId === userId);

    if (!isOwner) throw new ForbiddenException('Access denied');

    return booking;
  }

  async confirmBooking(userId: string, bookingId: string) {
    const provider = await this.getProviderProfile(userId);
    const booking = await this.getBookingOrThrow(bookingId);

    if (booking.providerId !== provider.id)
      throw new ForbiddenException('Not your booking');
    this.assertStatus(booking, ['pending']);

    const [updated] = await this.db
      .update(bookings)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    return updated;
  }

  async cancelBooking(userId: string, role: string, bookingId: string) {
    const booking = await this.getBookingOrThrow(bookingId);

    const isOwner =
      (role === 'customer' && booking.customer.userId === userId) ||
      (role === 'provider' && booking.provider.userId === userId);

    if (!isOwner) throw new ForbiddenException('Access denied');
    this.assertStatus(booking, ['pending', 'confirmed']);

    const [updated] = await this.db
      .update(bookings)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    return updated;
  }

  async completeBooking(userId: string, bookingId: string) {
    const provider = await this.getProviderProfile(userId);
    const booking = await this.getBookingOrThrow(bookingId);

    if (booking.providerId !== provider.id)
      throw new ForbiddenException('Not your booking');
    this.assertStatus(booking, ['confirmed']);

    const [updated] = await this.db
      .update(bookings)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    return updated;
  }
}
