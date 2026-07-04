import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, inArray, lt, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';

import {
  bookings,
  customerProfiles,
  providerProfiles,
  sliikOfferResponses,
  sliikOffers,
} from '../../db/schema';
import { CreateOfferDto } from './dto/create-offer.dto';
import { RespondToOfferDto } from './dto/respond-to-offer.dto';
import { PayoutsService } from '../payouts/payouts.service';
import { NotificationsService } from '../notifications/notifications.service';

type Db = NodePgDatabase<typeof schema>;

// Offers carry no serviceId/duration (unlike regular bookings), so there's
// no exact slot to check against getAvailableSlots' overlap math - instead,
// reject accepting a response if the provider already has a booking within
// this buffer window of the offer's preferred time.
const OFFER_CONFLICT_WINDOW_MINUTES = 60;

@Injectable()
export class OffersService {
  constructor(
    @Inject(DRIZZLE) private db: Db,
    private payoutsService: PayoutsService,
    private notificationsService: NotificationsService,
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

  async createOffer(userId: string, dto: CreateOfferDto) {
    const customer = await this.getCustomerProfile(userId);

    const preferredFrom = new Date(dto.preferredFrom);
    const preferredTo = new Date(dto.preferredTo);
    if (preferredFrom <= new Date()) {
      throw new BadRequestException('preferredFrom must be in the future');
    }
    if (preferredTo <= preferredFrom) {
      throw new BadRequestException('preferredTo must be after preferredFrom');
    }

    const [offer] = await this.db
      .insert(sliikOffers)
      .values({
        customerId: customer.id,
        serviceType: dto.serviceType,
        description: dto.description,
        budget: dto.budget?.toFixed(2),
        preferredFrom,
        preferredTo,
        city: dto.city,
      })
      .returning();

    // Fan-out: every provider in the same city is a candidate bidder,
    // mirroring getOpenOffers' own eligibility filter (city match only).
    const nearbyProviders = await this.db.query.providerProfiles.findMany({
      where: eq(providerProfiles.city, dto.city),
    });
    await Promise.all(
      nearbyProviders.map((provider) =>
        this.notificationsService.create(
          provider.userId,
          'offer_posted',
          'New Sliik Offer nearby',
          `${customer.fullName} is looking for ${dto.serviceType} in ${dto.city}`,
          { offerId: offer.id },
        ),
      ),
    );

    return offer;
  }

  async getMyOffers(userId: string) {
    const customer = await this.getCustomerProfile(userId);

    return this.db.query.sliikOffers.findMany({
      where: eq(sliikOffers.customerId, customer.id),
      with: { responses: { with: { provider: true } } },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
    });
  }

  async getOpenOffers(userId: string) {
    const provider = await this.getProviderProfile(userId);

    return this.db.query.sliikOffers.findMany({
      where: and(
        eq(sliikOffers.status, 'open'),
        eq(sliikOffers.city, provider.city ?? ''),
      ),
      with: { customer: true },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
    });
  }

  async getMyResponses(userId: string) {
    const provider = await this.getProviderProfile(userId);

    return this.db.query.sliikOfferResponses.findMany({
      where: eq(sliikOfferResponses.providerId, provider.id),
      with: { offer: { with: { customer: true } } },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
  }

  async getOfferById(userId: string, role: string, offerId: string) {
    const offer = await this.db.query.sliikOffers.findFirst({
      where: eq(sliikOffers.id, offerId),
      with: {
        customer: true,
        responses: { with: { provider: true } },
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    if (role === 'customer') {
      const customer = await this.getCustomerProfile(userId);
      if (offer.customerId !== customer.id)
        throw new ForbiddenException('Access denied');
    } else {
      // Providers can only see offers they're eligible to bid on (same city,
      // matching getOpenOffers) or ones they've already responded to -
      // otherwise this endpoint would leak every competitor's price/message
      // on any offer, to any provider who guesses/enumerates an id.
      const provider = await this.getProviderProfile(userId);
      const hasResponded = offer.responses.some(
        (response) => response.providerId === provider.id,
      );
      const sameCity = !!provider.city && provider.city === offer.city;
      if (!sameCity && !hasResponded) {
        throw new ForbiddenException('Access denied');
      }
    }

    return offer;
  }

  async cancelOffer(userId: string, offerId: string) {
    const customer = await this.getCustomerProfile(userId);

    const offer = await this.db.query.sliikOffers.findFirst({
      where: eq(sliikOffers.id, offerId),
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.customerId !== customer.id)
      throw new ForbiddenException('Not your offer');
    if (offer.status !== 'open') {
      throw new BadRequestException(
        `Cannot cancel an offer with status "${offer.status}"`,
      );
    }

    const [updated] = await this.db
      .update(sliikOffers)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(sliikOffers.id, offerId))
      .returning();

    return updated;
  }

  async respondToOffer(
    userId: string,
    offerId: string,
    dto: RespondToOfferDto,
  ) {
    const provider = await this.getProviderProfile(userId);

    const offer = await this.db.query.sliikOffers.findFirst({
      where: eq(sliikOffers.id, offerId),
      with: { customer: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== 'open') {
      throw new BadRequestException('This offer is no longer open');
    }

    const alreadyResponded = await this.db.query.sliikOfferResponses.findFirst({
      where: and(
        eq(sliikOfferResponses.offerId, offerId),
        eq(sliikOfferResponses.providerId, provider.id),
      ),
    });
    if (alreadyResponded)
      throw new BadRequestException('You have already responded to this offer');

    const [response] = await this.db
      .insert(sliikOfferResponses)
      .values({
        offerId,
        providerId: provider.id,
        offeredPrice: dto.offeredPrice.toFixed(2),
        message: dto.message,
      })
      .returning();

    await this.notificationsService.create(
      offer.customer.userId,
      'offer_response_received',
      'New offer response',
      `${provider.fullName} responded to your Sliik Offer`,
      { offerId, responseId: response.id },
    );

    return response;
  }

  async acceptResponse(userId: string, offerId: string, responseId: string) {
    const customer = await this.getCustomerProfile(userId);

    const offer = await this.db.query.sliikOffers.findFirst({
      where: eq(sliikOffers.id, offerId),
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.customerId !== customer.id)
      throw new ForbiddenException('Not your offer');
    if (offer.status !== 'open') {
      throw new BadRequestException(
        `Cannot accept a response on an offer with status "${offer.status}"`,
      );
    }

    const response = await this.db.query.sliikOfferResponses.findFirst({
      where: and(
        eq(sliikOfferResponses.id, responseId),
        eq(sliikOfferResponses.offerId, offerId),
      ),
      with: { provider: true },
    });
    if (!response) throw new NotFoundException('Response not found');
    if (response.status !== 'pending') {
      throw new BadRequestException('This response has already been processed');
    }

    await this.payoutsService.assertProviderPayable(response.providerId);

    const windowMs = OFFER_CONFLICT_WINDOW_MINUTES * 60 * 1000;
    const conflictingBooking = await this.db.query.bookings.findFirst({
      where: and(
        eq(bookings.providerId, response.providerId),
        inArray(bookings.status, ['pending', 'confirmed']),
        gte(
          bookings.scheduledAt,
          new Date(offer.preferredFrom.getTime() - windowMs),
        ),
        lt(
          bookings.scheduledAt,
          new Date(offer.preferredFrom.getTime() + windowMs),
        ),
      ),
    });
    if (conflictingBooking) {
      throw new BadRequestException(
        'This provider already has a booking too close to the preferred time',
      );
    }

    let createdBooking: typeof bookings.$inferSelect;

    await this.db.transaction(async (tx) => {
      await tx
        .update(sliikOffers)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(sliikOffers.id, offerId));

      await tx
        .update(sliikOfferResponses)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(sliikOfferResponses.id, responseId));

      await tx
        .update(sliikOfferResponses)
        .set({ status: 'declined', updatedAt: new Date() })
        .where(
          and(
            eq(sliikOfferResponses.offerId, offerId),
            ne(sliikOfferResponses.id, responseId),
          ),
        );

      const [booking] = await tx
        .insert(bookings)
        .values({
          customerId: customer.id,
          providerId: response.providerId,
          scheduledAt: offer.preferredFrom,
          notes: offer.description,
          totalAmount: response.offeredPrice,
        })
        .returning();

      createdBooking = booking;
    });

    await this.notificationsService.create(
      response.provider.userId,
      'offer_accepted',
      'Offer accepted',
      `${customer.fullName} accepted your offer`,
      { offerId, bookingId: createdBooking!.id },
    );

    return createdBooking!;
  }
}
