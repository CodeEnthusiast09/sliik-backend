import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../db';
import * as schema from '../../../db/schema';
import { users } from '../../../db/schema';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  // Re-fetch on every authenticated request so a deleted (deactivated) account's
  // still-valid JWT stops working immediately, instead of lasting until natural
  // expiry. One DB read per request - accepted at this app's scale.
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      columns: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is no longer active');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
