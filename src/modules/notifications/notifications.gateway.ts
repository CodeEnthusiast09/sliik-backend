import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

interface AuthenticatedSocket extends Socket {
  data: { userId: string };
}

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (!allowedOrigins?.length) {
  throw new Error(
    'ALLOWED_ORIGINS must be configured for the notifications gateway',
  );
}

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection<AuthenticatedSocket> {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
      });
      client.data.userId = payload.sub;
      await client.join(this.roomFor(payload.sub));
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

  private roomFor(userId: string) {
    return `user:${userId}`;
  }

  emitToUser(userId: string, notification: unknown) {
    this.server.to(this.roomFor(userId)).emit('newNotification', notification);
  }
}
