import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { users, customerProfiles, providerProfiles } from '../../db/schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AppleAuthDto } from './dto/apple-auth.dto';

type Db = NodePgDatabase<typeof schema>;

const APPLE_JWKS = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    @Inject(DRIZZLE) private db: Db,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async register(dto: RegisterDto) {
    const existing = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email: dto.email, passwordHash, role: dto.role })
        .returning();

      if (dto.role === 'customer') {
        await tx
          .insert(customerProfiles)
          .values({ userId: user.id, fullName: dto.fullName });
      } else {
        await tx.insert(providerProfiles).values({
          userId: user.id,
          fullName: dto.fullName,
          tradeType: dto.tradeType!,
        });
      }

      return this.buildTokenResponse(user.id, user.email, user.role);
    });
  }

  async login(dto: LoginDto) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.buildTokenResponse(user.id, user.email, user.role);
  }

  async googleAuth(dto: GoogleAuthDto) {
    const ticket = await this.googleClient
      .verifyIdToken({
        idToken: dto.idToken,
        audience: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      })
      .catch(() => {
        throw new UnauthorizedException('Invalid Google token');
      });

    const payload = ticket.getPayload();
    if (!payload?.sub) throw new UnauthorizedException('Invalid Google token');

    return this.findOrCreateSocialUser({
      googleId: payload.sub,
      email: payload.email ?? `${payload.sub}@google.com`,
      fullName: payload.name ?? 'User',
      role: dto.role,
    });
  }

  async appleAuth(dto: AppleAuthDto) {
    const { payload } = await jwtVerify(dto.identityToken, APPLE_JWKS, {
      issuer: 'https://appleid.apple.com',
      audience: this.config.getOrThrow<string>('APPLE_CLIENT_ID'),
    }).catch(() => {
      throw new UnauthorizedException('Invalid Apple token');
    });

    if (!payload.sub) throw new UnauthorizedException('Invalid Apple token');

    return this.findOrCreateSocialUser({
      appleId: payload.sub,
      email: (payload['email'] as string) ?? `${payload.sub}@privaterelay.appleid.com`,
      fullName: dto.fullName ?? 'User',
      role: dto.role,
    });
  }

  private async findOrCreateSocialUser(params: {
    googleId?: string;
    appleId?: string;
    email: string;
    fullName: string;
    role: 'customer' | 'provider';
  }) {
    const whereClause = params.googleId
      ? eq(users.googleId, params.googleId)
      : eq(users.appleId, params.appleId!);

    const existing = await this.db.query.users.findFirst({
      where: whereClause,
    });

    if (existing) {
      return this.buildTokenResponse(existing.id, existing.email, existing.role);
    }

    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: params.email,
          role: params.role,
          googleId: params.googleId,
          appleId: params.appleId,
          isEmailVerified: true,
        })
        .returning();

      if (params.role === 'customer') {
        await tx
          .insert(customerProfiles)
          .values({ userId: user.id, fullName: params.fullName });
      } else {
        // tradeType is 'pending' — provider completes profile in onboarding
        await tx.insert(providerProfiles).values({
          userId: user.id,
          fullName: params.fullName,
          tradeType: 'pending',
        });
      }

      return this.buildTokenResponse(user.id, user.email, user.role);
    });
  }

  private buildTokenResponse(userId: string, email: string, role: string) {
    return {
      accessToken: this.jwtService.sign({ sub: userId, email, role }),
      role,
    };
  }
}
