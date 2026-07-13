import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ChatService } from './chat.service';
import { ConversationRoomDto } from './dto/conversation-room.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

interface AuthenticatedSocket extends Socket {
  data: { userId: string };
}

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (!allowedOrigins?.length) {
  throw new Error('ALLOWED_ORIGINS must be configured for the chat gateway');
}

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})
export class ChatGateway
  implements
    OnGatewayConnection<AuthenticatedSocket>,
    OnGatewayDisconnect<AuthenticatedSocket>
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Presence is derived from live socket state, not persisted - a user can
  // have more than one tab/device connected, so "online" means "at least
  // one open socket", tracked by connection count rather than a boolean.
  private readonly onlineConnectionCounts = new Map<string, number>();
  // Which booking rooms each individual socket has joined, so a disconnect
  // knows exactly which rooms to notify without guessing.
  private readonly socketRooms = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private chatService: ChatService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
      });
      client.data.userId = payload.sub;
      this.onlineConnectionCounts.set(
        payload.sub,
        (this.onlineConnectionCounts.get(payload.sub) ?? 0) + 1,
      );
    } catch {
      this.logger.warn(
        `Rejected socket connection ${client.id}: invalid or missing token`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data?.userId;
    const rooms = this.socketRooms.get(client.id);
    this.socketRooms.delete(client.id);
    if (!userId) return;

    const remaining = (this.onlineConnectionCounts.get(userId) ?? 1) - 1;
    if (remaining > 0) {
      this.onlineConnectionCounts.set(userId, remaining);
      return;
    }

    // Last open socket for this user - they're now fully offline.
    this.onlineConnectionCounts.delete(userId);
    for (const bookingId of rooms ?? []) {
      this.server
        .to(this.roomFor(bookingId))
        .emit('presence', { userId, online: false });
    }
  }

  private isOnline(userId: string): boolean {
    return (this.onlineConnectionCounts.get(userId) ?? 0) > 0;
  }

  private extractToken(client: Socket): string {
    const raw =
      (client.handshake.auth?.token as string | undefined) ??
      client.handshake.headers.authorization;
    if (!raw) throw new UnauthorizedException('Missing token');
    return raw.startsWith('Bearer ') ? raw.slice(7) : raw;
  }

  private roomFor(bookingId: string) {
    return `booking:${bookingId}`;
  }

  @SubscribeMessage('joinConversation')
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: ConversationRoomDto,
  ) {
    await this.chatService.verifyParticipant(client.data.userId, dto.bookingId);
    await client.join(this.roomFor(dto.bookingId));

    if (!this.socketRooms.has(client.id)) {
      this.socketRooms.set(client.id, new Set());
    }
    this.socketRooms.get(client.id)!.add(dto.bookingId);

    // Let the room know this participant is online (covers them opening the
    // chat before the other party does), then tell the joining client the
    // other participant's current status directly - they may already be
    // online from before this client connected, so a room broadcast alone
    // wouldn't reach this client with that fact.
    this.server.to(this.roomFor(dto.bookingId)).emit('presence', {
      userId: client.data.userId,
      online: true,
    });

    const otherUserId = await this.chatService.getOtherParticipantUserId(
      client.data.userId,
      dto.bookingId,
    );
    client.emit('presence', {
      userId: otherUserId,
      online: this.isOnline(otherUserId),
    });
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const message = await this.chatService.sendMessage(client.data.userId, dto);
    this.server
      .to(this.roomFor(dto.bookingId))
      .emit('newMessage', { ...message, clientId: dto.clientId });
    return message;
  }

  @SubscribeMessage('markRead')
  async markRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: ConversationRoomDto,
  ) {
    await this.chatService.markMessagesRead(client.data.userId, dto.bookingId);
    this.server.to(this.roomFor(dto.bookingId)).emit('messagesRead', {
      bookingId: dto.bookingId,
      readBy: client.data.userId,
    });
  }

  @SubscribeMessage('deleteMessage')
  async deleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: DeleteMessageDto,
  ) {
    const { message, bookingId } = await this.chatService.deleteMessage(
      client.data.userId,
      dto.messageId,
    );
    this.server.to(this.roomFor(bookingId)).emit('messageDeleted', message);
    return message;
  }
}
