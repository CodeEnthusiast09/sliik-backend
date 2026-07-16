import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { providerProfiles, services } from '../../db/schema';
import { assertCloudinaryUrl } from '../../common/utils/cloudinary.helper';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class ServicesService {
  constructor(
    @Inject(DRIZZLE) private db: Db,
    private config: ConfigService,
  ) {}

  private async getProviderProfile(userId: string) {
    const profile = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Provider profile not found');
    return profile;
  }

  async createService(userId: string, dto: CreateServiceDto) {
    const profile = await this.getProviderProfile(userId);

    if (dto.imageUrl) {
      assertCloudinaryUrl(
        this.config.getOrThrow<string>('cloudinary.cloudName'),
        dto.imageUrl,
      );
    }

    const [service] = await this.db
      .insert(services)
      .values({
        providerId: profile.id,
        name: dto.name,
        description: dto.description,
        price: dto.price.toFixed(2),
        durationMinutes: dto.durationMinutes,
        category: dto.category,
        imageUrl: dto.imageUrl,
        addOns: dto.addOns,
      })
      .returning();

    return service;
  }

  async getMyServices(userId: string) {
    const profile = await this.getProviderProfile(userId);

    return this.db.query.services.findMany({
      where: eq(services.providerId, profile.id),
      orderBy: (s, { asc }) => [asc(s.createdAt)],
    });
  }

  async updateService(
    userId: string,
    serviceId: string,
    dto: UpdateServiceDto,
  ) {
    const profile = await this.getProviderProfile(userId);

    const existing = await this.db.query.services.findFirst({
      where: eq(services.id, serviceId),
    });
    if (!existing) throw new NotFoundException('Service not found');
    if (existing.providerId !== profile.id)
      throw new ForbiddenException('Not your service');

    if (dto.imageUrl) {
      assertCloudinaryUrl(
        this.config.getOrThrow<string>('cloudinary.cloudName'),
        dto.imageUrl,
      );
    }

    const updates: Partial<typeof services.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.price !== undefined) updates.price = dto.price.toFixed(2);
    if (dto.durationMinutes !== undefined)
      updates.durationMinutes = dto.durationMinutes;
    if (dto.category !== undefined) updates.category = dto.category;
    if (dto.imageUrl !== undefined) updates.imageUrl = dto.imageUrl;
    if (dto.addOns !== undefined) updates.addOns = dto.addOns;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;

    const [updated] = await this.db
      .update(services)
      .set(updates)
      .where(eq(services.id, serviceId))
      .returning();

    return updated;
  }

  async deleteService(userId: string, serviceId: string) {
    const profile = await this.getProviderProfile(userId);

    const existing = await this.db.query.services.findFirst({
      where: eq(services.id, serviceId),
    });
    if (!existing) throw new NotFoundException('Service not found');
    if (existing.providerId !== profile.id)
      throw new ForbiddenException('Not your service');

    await this.db
      .update(services)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(services.id, serviceId));
  }
}
