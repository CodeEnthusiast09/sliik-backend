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
  constructor(@Inject(DRIZZLE) private db: Db) {}

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

  async sendMessage(userId: string, dto: SendMessageDto) {
    const booking = await this.getBookingOrThrow(dto.bookingId);
    this.assertParticipant(userId, booking);

    const conversation = await this.getOrCreateConversation(dto.bookingId);

    const [message] = await this.db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        senderId: userId,
        content: dto.content,
      })
      .returning();

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
      return rows.filter((b) => b.conversation !== null && CHATTABLE_STATUSES.includes(b.status));
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
    return rows.filter((b) => b.conversation !== null && CHATTABLE_STATUSES.includes(b.status));
  }
}
