import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ChatService } from './chat.service';
import { ConversationRoomDto } from './dto/conversation-room.dto';
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
export class ChatGateway implements OnGatewayConnection<AuthenticatedSocket> {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

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
    } catch {
      this.logger.warn(
        `Rejected socket connection ${client.id}: invalid or missing token`,
      );
      client.disconnect(true);
    }
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
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const message = await this.chatService.sendMessage(client.data.userId, dto);
    this.server.to(this.roomFor(dto.bookingId)).emit('newMessage', message);
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
}
