import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import {
  bookings,
  customerProfiles,
  providerProfiles,
  services,
  sliikDeals,
} from '../../db/schema';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { ClaimDealDto } from './dto/claim-deal.dto';
import { PayoutsService } from '../payouts/payouts.service';
import { ProvidersService } from '../providers/providers.service';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class DealsService {
  constructor(
    @Inject(DRIZZLE) private db: Db,
    private payoutsService: PayoutsService,
    private providersService: ProvidersService,
  ) {}

  private async getProviderProfile(userId: string) {
    const profile = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Provider profile not found');
    return profile;
  }

  private async getCustomerProfile(userId: string) {
    const profile = await this.db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Customer profile not found');
    return profile;
  }

  async createDeal(userId: string, dto: CreateDealDto) {
    const provider = await this.getProviderProfile(userId);

    const service = await this.db.query.services.findFirst({
      where: and(
        eq(services.id, dto.serviceId),
        eq(services.providerId, provider.id),
      ),
    });
    if (!service)
      throw new NotFoundException(
        'Service not found or does not belong to you',
      );

    if (dto.dealPrice >= dto.originalPrice) {
      throw new BadRequestException(
        'Deal price must be lower than original price',
      );
    }

    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= new Date()) {
      throw new BadRequestException('Expiry date must be in the future');
    }

    const [deal] = await this.db
      .insert(sliikDeals)
      .values({
        providerId: provider.id,
        serviceId: dto.serviceId,
        title: dto.title,
        description: dto.description,
        originalPrice: dto.originalPrice.toFixed(2),
        dealPrice: dto.dealPrice.toFixed(2),
        slotsTotal: dto.slotsTotal,
        slotsRemaining: dto.slotsTotal,
        expiresAt,
      })
      .returning();

    return deal;
  }

  async getActiveDeals() {
    return this.db.query.sliikDeals.findMany({
      where: and(
        gt(sliikDeals.slotsRemaining, 0),
        gt(sliikDeals.expiresAt, new Date()),
      ),
      with: { provider: true, service: true },
      orderBy: (d, { asc }) => [asc(d.expiresAt)],
    });
  }

  async getMyDeals(userId: string) {
    const provider = await this.getProviderProfile(userId);

    return this.db.query.sliikDeals.findMany({
      where: eq(sliikDeals.providerId, provider.id),
      with: { service: true },
      orderBy: (d, { desc }) => [desc(d.createdAt)],
    });
  }

  async getDealById(id: string) {
    const deal = await this.db.query.sliikDeals.findFirst({
      where: eq(sliikDeals.id, id),
      with: { provider: true, service: true },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async updateDeal(userId: string, dealId: string, dto: UpdateDealDto) {
    const provider = await this.getProviderProfile(userId);

    const deal = await this.db.query.sliikDeals.findFirst({
      where: eq(sliikDeals.id, dealId),
    });
    if (!deal) throw new NotFoundException('Deal not found');
    if (deal.providerId !== provider.id)
      throw new ForbiddenException('Not your deal');

    if (dto.expiresAt) {
      const expiresAt = new Date(dto.expiresAt);
      if (expiresAt <= new Date()) {
        throw new BadRequestException('Expiry date must be in the future');
      }
    }

    if (dto.dealPrice !== undefined && dto.originalPrice !== undefined) {
      if (dto.dealPrice >= dto.originalPrice) {
        throw new BadRequestException(
          'Deal price must be lower than original price',
        );
      }
    } else if (dto.dealPrice !== undefined) {
      if (dto.dealPrice >= Number(deal.originalPrice)) {
        throw new BadRequestException(
          'Deal price must be lower than original price',
        );
      }
    } else if (dto.originalPrice !== undefined) {
      if (Number(deal.dealPrice) >= dto.originalPrice) {
        throw new BadRequestException(
          'Deal price must be lower than original price',
        );
      }
    }

    const [updated] = await this.db
      .update(sliikDeals)
      .set({
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.originalPrice !== undefined && {
          originalPrice: dto.originalPrice.toFixed(2),
        }),
        ...(dto.dealPrice !== undefined && {
          dealPrice: dto.dealPrice.toFixed(2),
        }),
        ...(dto.expiresAt !== undefined && {
          expiresAt: new Date(dto.expiresAt),
        }),
        updatedAt: new Date(),
      })
      .where(eq(sliikDeals.id, dealId))
      .returning();

    return updated;
  }

  async deleteDeal(userId: string, dealId: string) {
    const provider = await this.getProviderProfile(userId);

    const deal = await this.db.query.sliikDeals.findFirst({
      where: eq(sliikDeals.id, dealId),
    });
    if (!deal) throw new NotFoundException('Deal not found');
    if (deal.providerId !== provider.id)
      throw new ForbiddenException('Not your deal');

    await this.db.delete(sliikDeals).where(eq(sliikDeals.id, dealId));
  }

  async claimDeal(userId: string, dealId: string, dto: ClaimDealDto) {
    const customer = await this.getCustomerProfile(userId);

    const deal = await this.db.query.sliikDeals.findFirst({
      where: eq(sliikDeals.id, dealId),
    });
    if (!deal) throw new NotFoundException('Deal not found');
    if (deal.slotsRemaining <= 0)
      throw new BadRequestException('No slots remaining for this deal');
    if (deal.expiresAt <= new Date())
      throw new BadRequestException('This deal has expired');

    // A flash deal's limited slots are meant to be spread across multiple
    // customers, not hoarded by one - mirrors the one-response-per-provider
    // rule already enforced on Sliik Offers.
    const existingClaim = await this.db.query.bookings.findFirst({
      where: and(eq(bookings.dealId, dealId), eq(bookings.customerId, customer.id)),
    });
    if (existingClaim) {
      throw new BadRequestException('You have already claimed this deal');
    }

    await this.payoutsService.assertProviderPayable(deal.providerId);

    // Deals have a real serviceId/duration (unlike offers), so reuse the
    // exact same slot computation regular bookings validate against -
    // otherwise a claim could land in the past, on a day off, or on top of
    // an existing booking with no check at all.
    const { slots } = await this.providersService.getAvailableSlots(deal.providerId, {
      date: dto.scheduledAt.slice(0, 10),
      serviceId: deal.serviceId,
    });
    const requestedTime = new Date(dto.scheduledAt).getTime();
    const isAvailable = slots.some((slot) => new Date(slot).getTime() === requestedTime);
    if (!isAvailable) {
      throw new BadRequestException('This time is not available for the provider');
    }

    let createdBooking: typeof bookings.$inferSelect;

    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(sliikDeals)
        .set({
          slotsRemaining: sql`${sliikDeals.slotsRemaining} - 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sliikDeals.id, dealId),
            gt(sliikDeals.slotsRemaining, 0),
            gt(sliikDeals.expiresAt, new Date()),
          ),
        )
        .returning();

      if (!updated) {
        throw new BadRequestException('Deal is no longer available');
      }

      const [booking] = await tx
        .insert(bookings)
        .values({
          customerId: customer.id,
          providerId: deal.providerId,
          serviceId: deal.serviceId,
          dealId: deal.id,
          scheduledAt: new Date(dto.scheduledAt),
          totalAmount: deal.dealPrice,
        })
        .returning();

      createdBooking = booking;
    });

    return createdBooking!;
  }
}
