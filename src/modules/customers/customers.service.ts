import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { customerProfiles } from '../../db/schema';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class CustomersService {
  constructor(@Inject(DRIZZLE) private db: Db) {}

  async getProfile(userId: string) {
    const profile = await this.db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateCustomerProfileDto) {
    const profile = await this.db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const [updated] = await this.db
      .update(customerProfiles)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(customerProfiles.userId, userId))
      .returning();

    return updated;
  }
}
