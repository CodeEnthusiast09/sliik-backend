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
import { ProvidersService } from '../providers/providers.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

type Db = NodePgDatabase<typeof schema>;
type BookingStatus =
  'pending' | 'confirmed' | 'completed' | 'cancelled' | 'declined';

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DRIZZLE) private db: Db,
    private payoutsService: PayoutsService,
    private providersService: ProvidersService,
    private notificationsService: NotificationsService,
    private mail: MailService,
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

    // Re-check the exact requested slot is still free immediately before
    // inserting - the client already fetched available slots to build its
    // picker, but another customer could have booked the same time since.
    // Reuses the same schedule/day-off/conflict logic as the slots endpoint
    // so there's one source of truth for "is this time available".
    const requestedTime = new Date(dto.scheduledAt).getTime();
    const { slots } = await this.providersService.getAvailableSlots(
      dto.providerId,
      {
        date: dto.scheduledAt.slice(0, 10),
        serviceId: dto.serviceId,
      },
    );
    const stillAvailable = slots.some(
      (slot) => new Date(slot).getTime() === requestedTime,
    );
    if (!stillAvailable) {
      throw new BadRequestException('This time slot is no longer available');
    }

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

    await this.notificationsService.create(
      provider.userId,
      'booking_created',
      'New booking request',
      `${customer.fullName} requested ${service.name}`,
      { bookingId: booking.id },
    );
    void this.mail.sendBookingRequest(provider.userId, {
      customerName: customer.fullName,
      serviceName: service.name,
      scheduledAt: booking.scheduledAt,
      amount: booking.totalAmount,
    });

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

    await this.notificationsService.create(
      booking.customer.userId,
      'booking_confirmed',
      'Booking confirmed',
      `${booking.provider.fullName} confirmed your booking`,
      { bookingId },
    );
    void this.mail.sendBookingConfirmed(booking.customer.userId, {
      providerName: booking.provider.fullName,
      serviceName: booking.service?.name ?? 'Sliik Deal',
      scheduledAt: booking.scheduledAt,
      amount: booking.totalAmount,
    });

    return updated;
  }

  async declineBooking(userId: string, bookingId: string) {
    const provider = await this.getProviderProfile(userId);
    const booking = await this.getBookingOrThrow(bookingId);

    if (booking.providerId !== provider.id)
      throw new ForbiddenException('Not your booking');
    this.assertStatus(booking, ['pending']);

    const [updated] = await this.db
      .update(bookings)
      .set({ status: 'declined', updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    await this.notificationsService.create(
      booking.customer.userId,
      'booking_declined',
      'Booking declined',
      `${booking.provider.fullName} declined your booking request`,
      { bookingId },
    );
    void this.mail.sendBookingDeclined(booking.customer.userId, {
      providerName: booking.provider.fullName,
      serviceName: booking.service?.name ?? 'Sliik Deal',
    });

    return updated;
  }

  async cancelBooking(userId: string, role: string, bookingId: string) {
    const booking = await this.getBookingOrThrow(bookingId);

    const isOwner =
      (role === 'customer' && booking.customer.userId === userId) ||
      (role === 'provider' && booking.provider.userId === userId);

    if (!isOwner) throw new ForbiddenException('Access denied');

    // Providers decline a pending request instead of cancelling it (see
    // declineBooking) - cancel is for backing out of an already-confirmed
    // booking. Customers can still cancel a request at either stage.
    const allowedStatuses: BookingStatus[] =
      role === 'provider' ? ['confirmed'] : ['pending', 'confirmed'];
    this.assertStatus(booking, allowedStatuses);

    const [updated] = await this.db
      .update(bookings)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    const cancelledByProvider = role === 'provider';
    const recipientUserId = cancelledByProvider
      ? booking.customer.userId
      : booking.provider.userId;
    const cancellerName = cancelledByProvider
      ? booking.provider.fullName
      : booking.customer.fullName;
    await this.notificationsService.create(
      recipientUserId,
      'booking_cancelled',
      'Booking cancelled',
      `${cancellerName} cancelled the booking`,
      { bookingId },
    );
    void this.mail.sendBookingCancelled(recipientUserId, {
      cancellerName,
      serviceName: booking.service?.name ?? 'Sliik Deal',
      scheduledAt: booking.scheduledAt,
    });

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

    await this.notificationsService.create(
      booking.customer.userId,
      'booking_completed',
      'Booking completed',
      `Your appointment with ${booking.provider.fullName} is complete - leave a review!`,
      { bookingId },
    );
    void this.mail.sendBookingCompleted(booking.customer.userId, {
      providerName: booking.provider.fullName,
      serviceName: booking.service?.name ?? 'Sliik Deal',
    });

    return updated;
  }
}
