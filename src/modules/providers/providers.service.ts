import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import {
  providerProfiles,
  services,
  portfolio,
  providerAvailability,
  providerDaysOff,
  bookings,
} from '../../db/schema';
import { UpdateProviderProfileDto } from './dto/update-provider-profile.dto';
import { FindProvidersQueryDto } from './dto/find-providers-query.dto';
import { GetAvailableSlotsQueryDto } from './dto/get-available-slots-query.dto';

type Db = NodePgDatabase<typeof schema>;

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToIsoDateTime(date: string, minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mins = String(minutes % 60).padStart(2, '0');
  return `${date}T${hours}:${mins}:00.000Z`;
}

@Injectable()
export class ProvidersService {
  constructor(@Inject(DRIZZLE) private db: Db) {}

  async getMyProfile(userId: string) {
    const profile = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.userId, userId),
      with: { services: true, portfolio: true, availability: true, daysOff: true },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async updateMyProfile(userId: string, dto: UpdateProviderProfileDto) {
    const profile = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const [updated] = await this.db
      .update(providerProfiles)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(providerProfiles.userId, userId))
      .returning();

    return updated;
  }

  async getPublicProfile(providerId: string) {
    const profile = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.id, providerId),
      with: {
        services: { where: eq(services.isActive, true) },
        portfolio: true,
      },
    });
    if (!profile) throw new NotFoundException('Provider not found');
    return profile;
  }

  // Nigeria-only, single-timezone app - dates/times are treated as plain
  // UTC-equivalent clock-face values throughout, no timezone conversion.
  async getAvailableSlots(providerId: string, query: GetAvailableSlotsQueryDto) {
    const provider = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.id, providerId),
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const service = await this.db.query.services.findFirst({
      where: and(
        eq(services.id, query.serviceId),
        eq(services.providerId, providerId),
        eq(services.isActive, true),
      ),
    });
    if (!service) throw new NotFoundException('Service not found or not available');

    const dayOfWeek = new Date(`${query.date}T00:00:00.000Z`).getUTCDay();

    const dayOff = await this.db.query.providerDaysOff.findFirst({
      where: and(
        eq(providerDaysOff.providerId, providerId),
        eq(providerDaysOff.date, query.date),
      ),
    });
    if (dayOff) return { date: query.date, slots: [] };

    const schedule = await this.db.query.providerAvailability.findFirst({
      where: and(
        eq(providerAvailability.providerId, providerId),
        eq(providerAvailability.dayOfWeek, dayOfWeek),
      ),
    });
    if (!schedule) return { date: query.date, slots: [] };

    const dayStart = new Date(`${query.date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const existingBookings = await this.db.query.bookings.findMany({
      where: and(
        eq(bookings.providerId, providerId),
        inArray(bookings.status, ['pending', 'confirmed']),
        gte(bookings.scheduledAt, dayStart),
        lt(bookings.scheduledAt, dayEnd),
      ),
      with: { service: true },
    });

    const occupiedRanges = existingBookings.map((booking) => {
      const start = booking.scheduledAt.getTime();
      const durationMinutes = booking.service?.durationMinutes ?? 0;
      return { start, end: start + durationMinutes * 60 * 1000 };
    });

    const dayStartMinutes = parseTimeToMinutes(schedule.startTime);
    const dayEndMinutes = parseTimeToMinutes(schedule.endTime);
    const now = Date.now();

    const slots: string[] = [];
    for (
      let slotStart = dayStartMinutes;
      slotStart + service.durationMinutes <= dayEndMinutes;
      slotStart += service.durationMinutes
    ) {
      const slotIso = minutesToIsoDateTime(query.date, slotStart);
      const slotStartMs = new Date(slotIso).getTime();
      const slotEndMs = slotStartMs + service.durationMinutes * 60 * 1000;

      if (slotStartMs < now) continue;

      const conflicts = occupiedRanges.some(
        (range) => slotStartMs < range.end && range.start < slotEndMs,
      );
      if (conflicts) continue;

      slots.push(slotIso);
    }

    return { date: query.date, slots };
  }

  async findProviders(query: FindProvidersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (query.city) {
      conditions.push(eq(providerProfiles.city, query.city));
    }
    if (query.tradeType) {
      conditions.push(eq(providerProfiles.tradeType, query.tradeType));
    }
    if (query.minRating !== undefined) {
      conditions.push(
        gte(providerProfiles.avgRating, query.minRating.toFixed(2)),
      );
    }

    const hasLocation =
      query.lat !== undefined && query.lng !== undefined;
    const radiusKm = query.radiusKm ?? 10;

    if (hasLocation) {
      const distanceExpr = sql<number>`
        6371 * acos(
          least(1.0,
            cos(radians(${query.lat})) * cos(radians(${providerProfiles.latitude})) *
            cos(radians(${providerProfiles.longitude}) - radians(${query.lng})) +
            sin(radians(${query.lat})) * sin(radians(${providerProfiles.latitude}))
          )
        )
      `;
      conditions.push(sql`${distanceExpr} <= ${radiusKm}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(providerProfiles)
      .where(where)
      .limit(limit)
      .offset(offset);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(providerProfiles)
      .where(where);

    return {
      providers: rows,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }
}
