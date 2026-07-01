import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { notifications } from '../../db/schema';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { NotificationsGateway } from './notifications.gateway';

type Db = NodePgDatabase<typeof schema>;
type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'offer_received'
  | 'offer_accepted'
  | 'deal_claimed'
  | 'payment_received'
  | 'review_received'
  | 'message_received'
  | 'system';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private db: Db,
    private notificationsGateway: NotificationsGateway,
  ) {}

  // Called internally by other modules once trigger-wiring lands (Step 11 is infra-only for now).
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    const [notification] = await this.db
      .insert(notifications)
      .values({ userId, type, title, body, data })
      .returning();
    this.notificationsGateway.emitToUser(userId, notification);
    return notification;
  }

  async getMyNotifications(userId: string, query: NotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [eq(notifications.userId, userId)];
    if (query.unread) {
      conditions.push(isNull(notifications.readAt));
    }
    const where = and(...conditions);

    const rows = await this.db.query.notifications.findMany({
      where,
      orderBy: (n, { desc }) => [desc(n.createdAt)],
      limit,
      offset,
    });

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(where);

    return {
      notifications: rows,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      );
    return count;
  }

  async markAsRead(userId: string, notificationId: string) {
    const [updated] = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId),
        ),
      )
      .returning();
    if (!updated) throw new NotFoundException('Notification not found');
    return updated;
  }

  async markAllAsRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      );
  }
}
