import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SQL, and, eq, gte, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { providerProfiles, services, portfolio } from '../../db/schema';
import { UpdateProviderProfileDto } from './dto/update-provider-profile.dto';
import { FindProvidersQueryDto } from './dto/find-providers-query.dto';

type Db = NodePgDatabase<typeof schema>;

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
