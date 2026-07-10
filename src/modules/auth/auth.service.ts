import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  emailVerificationCodes,
} from '../../db/schema';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AppleAuthDto } from './dto/apple-auth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

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

    const user = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({ email: dto.email, passwordHash, role: dto.role })
        .returning();

      if (dto.role === 'customer') {
        await tx
          .insert(customerProfiles)
          .values({ userId: created.id, fullName: dto.fullName });
      } else {
        await tx.insert(providerProfiles).values({
          userId: created.id,
          fullName: dto.fullName,
          tradeType: dto.tradeType!,
        });
      }

      return created;
    });

    // No token yet: password signups must verify their email first (see
    // verifyEmail). The welcome email is sent only after verification.
    await this.issueEmailVerificationCode(user.id, user.email);

    return { email: user.email };
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

    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        'Please verify your email before signing in',
      );
    }

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

  async verifyEmail(dto: VerifyEmailDto) {
    // One generic error for every failure mode - never reveal whether the
    // email exists, whether a code was issued, or which check failed.
    const invalid = new BadRequestException('Invalid or expired code');

    const user = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });
    if (!user?.passwordHash) throw invalid;

    const record = await this.db.query.emailVerificationCodes.findFirst({
      where: eq(emailVerificationCodes.userId, user.id),
      orderBy: [desc(emailVerificationCodes.createdAt)],
    });

    const maxAttempts = this.config.getOrThrow<number>(
      'emailVerification.maxAttempts',
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
        .update(emailVerificationCodes)
        .set({ attempts: record.attempts + 1 })
        .where(eq(emailVerificationCodes.id, record.id));
      throw invalid;
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ isEmailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      await tx
        .update(emailVerificationCodes)
        .set({ usedAt: new Date() })
        .where(eq(emailVerificationCodes.id, record.id));
    });

    // Account is now actually usable, so the welcome email is sent here
    // rather than at registration.
    const fullName = await this.getProfileName(user.id, user.role);
    void this.mail.sendWelcome(user.email, fullName);

    return this.buildTokenResponse(user.id, user.email, user.role);
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, dto.email),
    });

    // Only send for an existing, unverified password account. OAuth accounts
    // are already verified and have no password. Generic response either way.
    if (!user?.passwordHash || user.isEmailVerified) return;

    const cooldownSeconds = this.config.getOrThrow<number>(
      'emailVerification.resendCooldownSeconds',
    );
    const latest = await this.db.query.emailVerificationCodes.findFirst({
      where: eq(emailVerificationCodes.userId, user.id),
      orderBy: [desc(emailVerificationCodes.createdAt)],
    });
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < cooldownSeconds * 1000
    ) {
      return;
    }

    await this.issueEmailVerificationCode(user.id, user.email);
  }

  private async issueEmailVerificationCode(userId: string, email: string) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiryMinutes = this.config.getOrThrow<number>(
      'emailVerification.codeExpiryMinutes',
    );
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // One live code per user: drop any prior codes before issuing a new one.
    await this.db
      .delete(emailVerificationCodes)
      .where(eq(emailVerificationCodes.userId, userId));
    await this.db
      .insert(emailVerificationCodes)
      .values({ userId, codeHash, expiresAt });

    try {
      await this.mail.sendEmailVerificationCode(email, code, expiryMinutes);
    } catch {
      // Already logged in MailService. Swallow so a transient mail outage
      // doesn't fail the request - the code is stored and can be resent.
    }
  }

  private async getProfileName(userId: string, role: string): Promise<string> {
    if (role === 'customer') {
      const profile = await this.db.query.customerProfiles.findFirst({
        where: eq(customerProfiles.userId, userId),
        columns: { fullName: true },
      });
      return profile?.fullName ?? 'there';
    }
    const profile = await this.db.query.providerProfiles.findFirst({
      where: eq(providerProfiles.userId, userId),
      columns: { fullName: true },
    });
    return profile?.fullName ?? 'there';
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
      emailVerified: payload.email_verified === true,
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
      // Apple only ever returns a verified email (real or private relay).
      emailVerified: true,
    });
  }

  private async findOrCreateSocialUser(params: {
    googleId?: string;
    appleId?: string;
    email: string;
    fullName: string;
    role: 'customer' | 'provider';
    emailVerified: boolean;
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

    // No social match yet. If an account already exists for this email, link
    // the social id to it instead of inserting a duplicate (the unique email
    // constraint would reject the insert anyway). Only link when the provider
    // verified the email, so an unverified-email token can't claim another
    // person's account.
    const byEmail = await this.db.query.users.findFirst({
      where: eq(users.email, params.email),
    });

    if (byEmail) {
      if (!params.emailVerified) {
        throw new UnauthorizedException(
          'Email not verified by provider; cannot link account',
        );
      }

      const [linked] = await this.db
        .update(users)
        .set(
          params.googleId
            ? { googleId: params.googleId }
            : { appleId: params.appleId },
        )
        .where(eq(users.id, byEmail.id))
        .returning();

      return this.buildTokenResponse(linked.id, linked.email, linked.role);
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
