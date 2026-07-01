import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class PaystackWebhookGuard implements CanActivate {
  private readonly secretKey: string;

  constructor(private config: ConfigService) {
    this.secretKey = this.config.getOrThrow<string>('paystack.secretKey');
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const signature = req.headers['x-paystack-signature'] as string | undefined;

    if (!signature)
      throw new UnauthorizedException('Missing Paystack signature header');

    const rawBody = req.rawBody;
    if (!rawBody) throw new UnauthorizedException('Missing request body');

    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');

    const hashBuf = Buffer.from(hash, 'hex');
    const sigBuf = Buffer.from(signature, 'hex');

    const valid =
      hashBuf.length === sigBuf.length &&
      crypto.timingSafeEqual(hashBuf, sigBuf);
    if (!valid) throw new UnauthorizedException('Invalid Paystack signature');

    return true;
  }
}
