import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { providerProfiles, providerAvailability, providerDaysOff } from '../../db/schema';
import { SetScheduleDto } from './dto/set-schedule.dto';
import { AddDayOffDto } from './dto/add-day-off.dto';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class AvailabilityService {
  constructor(@Inject(DRIZZLE) private db: Db) {}

  private async getProviderProfile(userId: string) {
    const profile = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Provider profile not found');
    return profile;
  }

  async setSchedule(userId: string, dto: SetScheduleDto) {
    const profile = await this.getProviderProfile(userId);

    await this.db.transaction(async (tx) => {
      await tx
        .delete(providerAvailability)
        .where(eq(providerAvailability.providerId, profile.id));

      if (dto.slots.length > 0) {
        await tx.insert(providerAvailability).values(
          dto.slots.map((slot) => ({
            providerId: profile.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        );
      }
    });

    return this.db.query.providerAvailability.findMany({
      where: eq(providerAvailability.providerId, profile.id),
      orderBy: (a, { asc }) => [asc(a.dayOfWeek)],
    });
  }

  async getSchedule(userId: string) {
    const profile = await this.getProviderProfile(userId);

    return this.db.query.providerAvailability.findMany({
      where: eq(providerAvailability.providerId, profile.id),
      orderBy: (a, { asc }) => [asc(a.dayOfWeek)],
    });
  }

  async addDayOff(userId: string, dto: AddDayOffDto) {
    const profile = await this.getProviderProfile(userId);

    const [dayOff] = await this.db
      .insert(providerDaysOff)
      .values({
        providerId: profile.id,
        date: dto.date,
        reason: dto.reason,
      })
      .returning();

    return dayOff;
  }

  async getDaysOff(userId: string) {
    const profile = await this.getProviderProfile(userId);

    return this.db.query.providerDaysOff.findMany({
      where: eq(providerDaysOff.providerId, profile.id),
      orderBy: (d, { asc }) => [asc(d.date)],
    });
  }

  async removeDayOff(userId: string, dayOffId: string) {
    const profile = await this.getProviderProfile(userId);

    const existing = await this.db.query.providerDaysOff.findFirst({
      where: eq(providerDaysOff.id, dayOffId),
    });
    if (!existing) throw new NotFoundException('Day off not found');
    if (existing.providerId !== profile.id) throw new ForbiddenException('Not your day off entry');

    await this.db
      .delete(providerDaysOff)
      .where(eq(providerDaysOff.id, dayOffId));
  }
}
