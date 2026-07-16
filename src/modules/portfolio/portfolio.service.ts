import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { portfolio, providerProfiles } from '../../db/schema';
import { CreatePortfolioItemDto } from './dto/create-portfolio-item.dto';
import { ReorderPortfolioDto } from './dto/reorder-portfolio.dto';
import { assertCloudinaryUrl } from '../../common/utils/cloudinary.helper';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class PortfolioService {
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

  async addItem(userId: string, dto: CreatePortfolioItemDto) {
    const profile = await this.getProviderProfile(userId);
    assertCloudinaryUrl(
      this.config.getOrThrow<string>('cloudinary.cloudName'),
      dto.imageUrl,
    );

    const [item] = await this.db
      .insert(portfolio)
      .values({
        providerId: profile.id,
        imageUrl: dto.imageUrl,
        title: dto.title,
        category: dto.category,
        caption: dto.caption,
      })
      .returning();

    return item;
  }

  async getMyPortfolio(userId: string) {
    const profile = await this.getProviderProfile(userId);

    return this.db.query.portfolio.findMany({
      where: eq(portfolio.providerId, profile.id),
      orderBy: (p, { asc }) => [asc(p.sortOrder)],
    });
  }

  async getProviderPortfolio(providerId: string) {
    return this.db.query.portfolio.findMany({
      where: eq(portfolio.providerId, providerId),
      orderBy: (p, { asc }) => [asc(p.sortOrder)],
    });
  }

  async reorder(userId: string, dto: ReorderPortfolioDto) {
    const profile = await this.getProviderProfile(userId);

    const items = await this.db.query.portfolio.findMany({
      where: inArray(portfolio.id, dto.orderedIds),
    });
    if (items.length !== dto.orderedIds.length) {
      throw new NotFoundException('One or more portfolio items not found');
    }
    if (items.some((item) => item.providerId !== profile.id)) {
      throw new ForbiddenException('Not your portfolio item');
    }

    await this.db.transaction(async (tx) => {
      for (const [index, id] of dto.orderedIds.entries()) {
        await tx
          .update(portfolio)
          .set({ sortOrder: index })
          .where(eq(portfolio.id, id));
      }
    });
  }

  async deleteItem(userId: string, itemId: string) {
    const profile = await this.getProviderProfile(userId);

    const existing = await this.db.query.portfolio.findFirst({
      where: eq(portfolio.id, itemId),
    });
    if (!existing) throw new NotFoundException('Portfolio item not found');
    if (existing.providerId !== profile.id)
      throw new ForbiddenException('Not your portfolio item');

    await this.db.delete(portfolio).where(eq(portfolio.id, itemId));
  }
}
