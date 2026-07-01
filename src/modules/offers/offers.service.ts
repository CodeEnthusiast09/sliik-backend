import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
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

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class OffersService {
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

  async createOffer(userId: string, dto: CreateOfferDto) {
    const customer = await this.getCustomerProfile(userId);

    const [offer] = await this.db
      .insert(sliikOffers)
      .values({
        customerId: customer.id,
        serviceType: dto.serviceType,
        description: dto.description,
        budget: dto.budget?.toFixed(2),
        preferredFrom: new Date(dto.preferredFrom),
        preferredTo: new Date(dto.preferredTo),
        city: dto.city,
      })
      .returning();

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
    });
    if (!response) throw new NotFoundException('Response not found');
    if (response.status !== 'pending') {
      throw new BadRequestException('This response has already been processed');
    }

    await this.payoutsService.assertProviderPayable(response.providerId);

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

    return createdBooking!;
  }
}
