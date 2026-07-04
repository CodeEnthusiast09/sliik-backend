import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { devicePushTokens, notifications } from '../../db/schema';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { NotificationsGateway } from './notifications.gateway';
import { ExpoPushService } from './expo-push.service';

type Db = NodePgDatabase<typeof schema>;
export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_declined'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'booking_reminder'
  | 'offer_posted'
  | 'offer_response_received'
  | 'offer_accepted'
  | 'deal_posted'
  | 'deal_claimed'
  | 'payment_received'
  | 'payment_sent'
  | 'review_received'
  | 'message_received'
  | 'system';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private db: Db,
    private notificationsGateway: NotificationsGateway,
    private expoPushService: ExpoPushService,
  ) {}

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

    const tokens = await this.db.query.devicePushTokens.findMany({
      where: eq(devicePushTokens.userId, userId),
    });
    if (tokens.length) {
      const staleTokens = await this.expoPushService.sendToTokens(
        tokens.map((t) => t.expoPushToken),
        title,
        body,
        data,
      );
      if (staleTokens.length) {
        await this.db
          .delete(devicePushTokens)
          .where(inArray(devicePushTokens.expoPushToken, staleTokens));
      }
    }

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

  // A device token can outlive a logout/login on a shared device, so a
  // re-registration always wins the token regardless of which user it was
  // last attached to - upsert on the token itself, not (userId, token).
  async registerPushToken(
    userId: string,
    expoPushToken: string,
    platform?: string,
  ) {
    await this.db
      .insert(devicePushTokens)
      .values({ userId, expoPushToken, platform })
      .onConflictDoUpdate({
        target: devicePushTokens.expoPushToken,
        set: { userId, platform, updatedAt: new Date() },
      });
  }

  async unregisterPushToken(userId: string, expoPushToken: string) {
    await this.db
      .delete(devicePushTokens)
      .where(
        and(
          eq(devicePushTokens.expoPushToken, expoPushToken),
          eq(devicePushTokens.userId, userId),
        ),
      );
  }
}
