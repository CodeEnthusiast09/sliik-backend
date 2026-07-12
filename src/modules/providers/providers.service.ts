import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SQL,
  and,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import {
  users,
  providerProfiles,
  services,
  providerAvailability,
  providerDaysOff,
  bookings,
  sliikDeals,
} from '../../db/schema';
import { UpdateProviderProfileDto } from './dto/update-provider-profile.dto';
import { FindProvidersQueryDto } from './dto/find-providers-query.dto';
import { GetAvailableSlotsQueryDto } from './dto/get-available-slots-query.dto';
import { canonicalCityEq } from '../../common/utils/location.helper';

type Db = NodePgDatabase<typeof schema>;

// Slots are offered at a fixed cadence regardless of the service's own
// duration - a candidate slot only needs to start inside the provider's
// working window, it's no longer required to finish before closing time.
// A long service can run past close; the provider is the one who judges
// whether that's workable and declines the request if it isn't.
const SLOT_INTERVAL_MINUTES = 30;

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
      with: {
        services: true,
        portfolio: true,
        availability: true,
        daysOff: true,
      },
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
        deals: {
          where: and(
            gt(sliikDeals.slotsRemaining, 0),
            gt(sliikDeals.expiresAt, new Date()),
          ),
        },
      },
    });
    if (!profile) throw new NotFoundException('Provider not found');

    // Hide soft-deleted (anonymized) providers from public view. Done as a
    // separate read rather than a joined filter because the relational query
    // API above aliases the table internally, so a raw correlated subquery in
    // its `where` would reference an out-of-scope alias.
    const owner = await this.db.query.users.findFirst({
      where: eq(users.id, profile.userId),
      columns: { isActive: true },
    });
    if (!owner?.isActive) throw new NotFoundException('Provider not found');

    return profile;
  }

  // Nigeria-only, single-timezone app - dates/times are treated as plain
  // UTC-equivalent clock-face values throughout, no timezone conversion.
  async getAvailableSlots(
    providerId: string,
    query: GetAvailableSlotsQueryDto,
  ) {
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
    if (!service)
      throw new NotFoundException('Service not found or not available');

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
      slotStart < dayEndMinutes;
      slotStart += SLOT_INTERVAL_MINUTES
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

    // Exclude soft-deleted (anonymized) providers from discovery.
    conditions.push(
      sql`exists (select 1 from ${users} where ${users.id} = ${providerProfiles.userId} and ${users.isActive} = true)`,
    );

    if (query.city) {
      conditions.push(canonicalCityEq(providerProfiles.city, query.city));
    }
    if (query.tradeType) {
      // ilike with no wildcards is a case-insensitive equality check - defends
      // against pre-existing mixed-case rows even though writes now normalize.
      conditions.push(ilike(providerProfiles.tradeType, query.tradeType));
    }
    if (query.search) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(providerProfiles.fullName, term),
          ilike(providerProfiles.tradeType, term),
        )!,
      );
    }
    if (query.minRating !== undefined) {
      conditions.push(
        gte(providerProfiles.avgRating, query.minRating.toFixed(2)),
      );
    }

    const hasLocation = query.lat !== undefined && query.lng !== undefined;
    const radiusKm = query.radiusKm ?? 10;

    // A text search is a specific-target query - the customer already knows
    // who/what they're looking for, so distance shouldn't silently exclude a
    // valid name/tradeType match. Only constrain by radius for plain
    // browsing (no search term).
    if (hasLocation && !query.search) {
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
      // Offset pagination needs a total order to be stable across separate
      // requests - without it, concurrent inserts (or even just Postgres's
      // own lack of an ordering guarantee) can return the same row on two
      // different pages. createdAt alone isn't enough since bulk inserts can
      // share an identical timestamp, so id breaks ties.
      .orderBy(desc(providerProfiles.createdAt), providerProfiles.id)
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
