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
import { portfolio, providerProfiles } from '../../db/schema';
import { CreatePortfolioItemDto } from './dto/create-portfolio-item.dto';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class PortfolioService {
  constructor(@Inject(DRIZZLE) private db: Db) {}

  private async getProviderProfile(userId: string) {
    const profile = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Provider profile not found');
    return profile;
  }

  async addItem(userId: string, dto: CreatePortfolioItemDto) {
    const profile = await this.getProviderProfile(userId);

    const [item] = await this.db
      .insert(portfolio)
      .values({
        providerId: profile.id,
        imageUrl: dto.imageUrl,
        caption: dto.caption,
      })
      .returning();

    return item;
  }

  async getMyPortfolio(userId: string) {
    const profile = await this.getProviderProfile(userId);

    return this.db.query.portfolio.findMany({
      where: eq(portfolio.providerId, profile.id),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
  }

  async getProviderPortfolio(providerId: string) {
    return this.db.query.portfolio.findMany({
      where: eq(portfolio.providerId, providerId),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
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
