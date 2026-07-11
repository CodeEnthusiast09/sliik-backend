import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { favorites } from '../../db/schema';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class FavoritesService {
  constructor(@Inject(DRIZZLE) private db: Db) {}

  async addFavorite(customerId: string, providerId: string) {
    await this.db
      .insert(favorites)
      .values({ customerId, providerId })
      .onConflictDoNothing();
  }

  async removeFavorite(customerId: string, providerId: string) {
    await this.db
      .delete(favorites)
      .where(
        and(
          eq(favorites.customerId, customerId),
          eq(favorites.providerId, providerId),
        ),
      );
  }

  async isFavorited(customerId: string, providerId: string) {
    const row = await this.db.query.favorites.findFirst({
      where: and(
        eq(favorites.customerId, customerId),
        eq(favorites.providerId, providerId),
      ),
    });
    return !!row;
  }
}
