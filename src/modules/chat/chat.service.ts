import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import {
  bookings,
  conversations,
  customerProfiles,
  messages,
  providerProfiles,
} from '../../db/schema';
import { SendMessageDto } from './dto/send-message.dto';
import { NotificationsService } from '../notifications/notifications.service';

type Db = NodePgDatabase<typeof schema>;
type BookingWithParties = {
  status: string;
  customer: { userId: string };
  provider: { userId: string };
};

// Chat is scoped to the booking context, not open DMs - only usable once
// the provider has confirmed, and stays open (read + write) after
// completion for follow-ups/rebooking. Blocked while still pending
// (nothing to discuss yet) and once cancelled/declined (no ongoing
// relationship left to message about).
const CHATTABLE_STATUSES = ['confirmed', 'completed'];

@Injectable()
export class ChatService {
  constructor(
    @Inject(DRIZZLE) private db: Db,
    private notificationsService: NotificationsService,
  ) {}

  private async getCustomerProfile(userId: string) {
    const profile = await this.db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Customer profile not found');
    return profile;
  }

  private async getProviderProfile(userId: string) {
    const profile = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.userId, userId),
    });
    if (!profile) throw new NotFoundException('Provider profile not found');
    return profile;
  }

  private async getBookingOrThrow(bookingId: string) {
    const booking = await this.db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: { customer: true, provider: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private assertParticipant(userId: string, booking: BookingWithParties) {
    if (
      booking.customer.userId !== userId &&
      booking.provider.userId !== userId
    ) {
      throw new ForbiddenException('You are not a participant of this booking');
    }
    if (!CHATTABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException(
        `Chat is not available on a booking with status "${booking.status}"`,
      );
    }
  }

  private async getOrCreateConversation(bookingId: string) {
    const existing = await this.db.query.conversations.findFirst({
      where: eq(conversations.bookingId, bookingId),
    });
    if (existing) return existing;

    const [created] = await this.db
      .insert(conversations)
      .values({ bookingId })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    const conversation = await this.db.query.conversations.findFirst({
      where: eq(conversations.bookingId, bookingId),
    });
    return conversation!;
  }

  async verifyParticipant(userId: string, bookingId: string) {
    const booking = await this.getBookingOrThrow(bookingId);
    this.assertParticipant(userId, booking);
  }

  async getOtherParticipantUserId(userId: string, bookingId: string) {
    const booking = await this.getBookingOrThrow(bookingId);
    return booking.customer.userId === userId
      ? booking.provider.userId
      : booking.customer.userId;
  }

  async sendMessage(userId: string, dto: SendMessageDto) {
    const booking = await this.getBookingOrThrow(dto.bookingId);
    this.assertParticipant(userId, booking);

    const conversation = await this.getOrCreateConversation(dto.bookingId);

    const [message] = await this.db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        senderId: userId,
        type: dto.type ?? 'text',
        content: dto.content ?? '',
        mediaUrl: dto.mediaUrl ?? null,
      })
      .returning();

    const isSenderCustomer = booking.customer.userId === userId;
    const recipientUserId = isSenderCustomer
      ? booking.provider.userId
      : booking.customer.userId;
    const senderName = isSenderCustomer
      ? booking.customer.fullName
      : booking.provider.fullName;
    // An image/audio message can carry no caption - fall back to a label so
    // the push notification body is never blank.
    const notificationBody =
      dto.type === 'image'
        ? '📷 Photo'
        : dto.type === 'audio'
          ? '🎤 Voice message'
          : dto.content;
    // In-app delivery while the recipient has the app open is already
    // handled live by ChatGateway's own socket broadcast - this push is
    // purely for reaching them once they've backgrounded the app.
    await this.notificationsService.create(
      recipientUserId,
      'message_received',
      senderName,
      notificationBody,
      { bookingId: dto.bookingId },
    );

    return message;
  }

  async getMessages(userId: string, bookingId: string) {
    const booking = await this.getBookingOrThrow(bookingId);
    this.assertParticipant(userId, booking);

    const conversation = await this.db.query.conversations.findFirst({
      where: eq(conversations.bookingId, bookingId),
    });
    if (!conversation) return [];

    return this.db.query.messages.findMany({
      where: eq(messages.conversationId, conversation.id),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });
  }

  async markMessagesRead(userId: string, bookingId: string) {
    const booking = await this.getBookingOrThrow(bookingId);
    this.assertParticipant(userId, booking);

    const conversation = await this.db.query.conversations.findFirst({
      where: eq(conversations.bookingId, bookingId),
    });
    if (!conversation) return;

    await this.db
      .update(messages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messages.conversationId, conversation.id),
          ne(messages.senderId, userId),
          isNull(messages.readAt),
        ),
      );
  }

  // "Delete for everyone" - only the sender can retract their own message,
  // and the content/mediaUrl are actually cleared (not just hidden behind a
  // flag) so a raw API response can't leak what was deleted.
  async deleteMessage(userId: string, messageId: string) {
    const message = await this.db.query.messages.findFirst({
      where: eq(messages.id, messageId),
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    const conversation = await this.db.query.conversations.findFirst({
      where: eq(conversations.id, message.conversationId),
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const [updated] = await this.db
      .update(messages)
      .set({ content: '', mediaUrl: null, deletedAt: new Date() })
      .where(eq(messages.id, messageId))
      .returning();

    return { message: updated, bookingId: conversation.bookingId };
  }

  async getMyConversations(userId: string, role: string) {
    if (role === 'customer') {
      const customer = await this.getCustomerProfile(userId);

      const rows = await this.db.query.bookings.findMany({
        where: eq(bookings.customerId, customer.id),
        with: {
          provider: true,
          service: true,
          conversation: {
            with: {
              messages: {
                orderBy: (m, { desc }) => [desc(m.createdAt)],
                limit: 1,
              },
            },
          },
        },
        orderBy: (b, { desc }) => [desc(b.createdAt)],
      });
      // Also excludes cancelled/declined bookings - otherwise a dead
      // conversation would still show up in the list and 400 as soon as
      // it's opened, since getMessages enforces the same status scoping.
      return rows
        .filter(
          (b) =>
            b.conversation !== null && CHATTABLE_STATUSES.includes(b.status),
        )
        .sort(byLastActivityDesc);
    }

    const provider = await this.getProviderProfile(userId);

    const rows = await this.db.query.bookings.findMany({
      where: eq(bookings.providerId, provider.id),
      with: {
        customer: true,
        service: true,
        conversation: {
          with: {
            messages: {
              orderBy: (m, { desc }) => [desc(m.createdAt)],
              limit: 1,
            },
          },
        },
      },
      orderBy: (b, { desc }) => [desc(b.createdAt)],
    });
    return rows
      .filter(
        (b) => b.conversation !== null && CHATTABLE_STATUSES.includes(b.status),
      )
      .sort(byLastActivityDesc);
  }
}

type ConversationRow = {
  createdAt: Date;
  conversation: { createdAt: Date; messages: { createdAt: Date }[] } | null;
};

// Most recent message wins; falls back to the conversation's own createdAt
// (no messages yet) and finally the booking's createdAt as a last resort -
// sorting by booking creation date alone left old bookings stuck at the
// bottom even right after a brand new message came in.
function lastActivityAt(row: ConversationRow): number {
  const lastMessageAt = row.conversation?.messages[0]?.createdAt;
  const fallback = row.conversation?.createdAt ?? row.createdAt;
  return (lastMessageAt ?? fallback).getTime();
}

function byLastActivityDesc(a: ConversationRow, b: ConversationRow): number {
  return lastActivityAt(b) - lastActivityAt(a);
}
