import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import {
  users,
  customerProfiles,
  providerProfiles,
  passwordResetCodes,
} from '../../db/schema';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AppleAuthDto } from './dto/apple-auth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

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
    private mail: MailService,
  ) {
    this.googleClient = new OAuth2Client(
      config.getOrThrow<string>('google.clientId'),
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

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });

    // Anti-enumeration: the controller always returns the same generic message.
    // Only actually generate + send when the account exists and is a password
    // account (OAuth-only accounts have no password to reset).
    if (!user?.passwordHash) return;

    // Per-email resend cooldown: silently no-op on rapid repeat requests so a
    // caller can't spam a victim's inbox (or probe timing).
    const cooldownSeconds = this.config.getOrThrow<number>(
      'passwordReset.resendCooldownSeconds',
    );
    const latest = await this.db.query.passwordResetCodes.findFirst({
      where: eq(passwordResetCodes.userId, user.id),
      orderBy: [desc(passwordResetCodes.createdAt)],
    });
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < cooldownSeconds * 1000
    ) {
      return;
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiryMinutes = this.config.getOrThrow<number>(
      'passwordReset.codeExpiryMinutes',
    );
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // One live code per user: drop any prior codes before issuing a new one.
    await this.db
      .delete(passwordResetCodes)
      .where(eq(passwordResetCodes.userId, user.id));
    await this.db
      .insert(passwordResetCodes)
      .values({ userId: user.id, codeHash, expiresAt });

    try {
      await this.mail.sendPasswordResetCode(user.email, code, expiryMinutes);
    } catch {
      // Already logged in MailService. Swallow so a transient mail outage
      // doesn't 500 the user, and the generic response can't be used to tell
      // an existing account apart from a missing one.
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    // One generic error for every failure mode - never reveal whether the email
    // exists, whether a code was issued, or which specific check failed.
    const invalid = new BadRequestException('Invalid or expired code');

    const user = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });
    if (!user?.passwordHash) throw invalid;

    const record = await this.db.query.passwordResetCodes.findFirst({
      where: eq(passwordResetCodes.userId, user.id),
      orderBy: [desc(passwordResetCodes.createdAt)],
    });

    const maxAttempts = this.config.getOrThrow<number>(
      'passwordReset.maxAttempts',
    );

    if (
      !record ||
      record.usedAt ||
      record.expiresAt.getTime() < Date.now() ||
      record.attempts >= maxAttempts
    ) {
      throw invalid;
    }

    const valid = await bcrypt.compare(dto.code, record.codeHash);
    if (!valid) {
      await this.db
        .update(passwordResetCodes)
        .set({ attempts: record.attempts + 1 })
        .where(eq(passwordResetCodes.id, record.id));
      throw invalid;
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      await tx
        .update(passwordResetCodes)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetCodes.id, record.id));
    });
  }

  async googleAuth(dto: GoogleAuthDto) {
    const ticket = await this.googleClient
      .verifyIdToken({
        idToken: dto.idToken,
        audience: this.config.getOrThrow<string>('google.clientId'),
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
      audience: this.config.getOrThrow<string>('apple.clientId'),
    }).catch(() => {
      throw new UnauthorizedException('Invalid Apple token');
    });

    if (!payload.sub) throw new UnauthorizedException('Invalid Apple token');

    return this.findOrCreateSocialUser({
      appleId: payload.sub,
      email:
        (payload['email'] as string) ??
        `${payload.sub}@privaterelay.appleid.com`,
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
      return this.buildTokenResponse(
        existing.id,
        existing.email,
        existing.role,
      );
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
