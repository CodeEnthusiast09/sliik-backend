import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { join } from 'path';
import { createElement } from 'react';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { users } from '../../db/schema';
import { BookingCancelledEmail } from './emails/booking-cancelled';
import { BookingConfirmedEmail } from './emails/booking-confirmed';
import { BookingDeclinedEmail } from './emails/booking-declined';
import { BookingRequestEmail } from './emails/booking-request';
import { PasswordResetEmail } from './emails/password-reset';
import { PaymentReceiptEmail } from './emails/payment-receipt';
import { WelcomeEmail } from './emails/welcome';

type Db = NodePgDatabase<typeof schema>;

interface BookingRequestData {
  customerName: string;
  serviceName: string;
  scheduledAt: Date;
  amount: number | string;
}

interface BookingConfirmedData {
  providerName: string;
  serviceName: string;
  scheduledAt: Date;
  amount: number | string;
}

interface BookingDeclinedData {
  providerName: string;
  serviceName: string;
}

interface BookingCancelledData {
  cancellerName: string;
  serviceName: string;
  scheduledAt: Date;
}

interface PaymentReceiptData {
  providerName: string;
  serviceName: string;
  amount: number | string;
  reference: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  // The backend runs from its project root (both `start:dev` and
  // `node dist/src/main.js`), so the source asset path resolves reliably.
  private readonly logoPath = join(
    process.cwd(),
    'src/modules/mail/emails/assets/sliik-mark.png',
  );

  constructor(
    private config: ConfigService,
    @Inject(DRIZZLE) private db: Db,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('mail.host'),
      port: this.config.getOrThrow<number>('mail.port'),
      secure: this.config.getOrThrow<boolean>('mail.secure'),
      auth: {
        user: this.config.getOrThrow<string>('mail.user'),
        pass: this.config.getOrThrow<string>('mail.password'),
      },
    });

    const fromName = this.config.getOrThrow<string>('mail.fromName');
    const fromAddress = this.config.getOrThrow<string>('mail.fromAddress');
    this.from = `"${fromName}" <${fromAddress}>`;
  }

  async sendPasswordResetCode(to: string, code: string, expiryMinutes: number) {
    const html = await render(
      createElement(PasswordResetEmail, { code, expiryMinutes }),
    );
    const text = `Your Sliik password reset code is ${code}. It expires in ${expiryMinutes} minutes.`;

    await this.send({
      to,
      subject: 'Your Sliik password reset code',
      html,
      text,
    });
  }

  async sendWelcome(to: string, fullName: string): Promise<void> {
    try {
      const html = await render(createElement(WelcomeEmail, { fullName }));
      const text = `Welcome to Sliik, ${fullName}. Your account is ready. Book trusted beauty and grooming pros, or take bookings, right in the app.`;
      await this.send({ to, subject: 'Welcome to Sliik', html, text });
    } catch (error) {
      this.logger.error('Failed to send welcome email', error as Error);
    }
  }

  async sendBookingRequest(
    providerUserId: string,
    data: BookingRequestData,
  ): Promise<void> {
    try {
      const to = await this.resolveEmail(providerUserId);
      if (!to) return;
      const when = this.formatDateTime(data.scheduledAt);
      const amount = this.formatAmount(data.amount);
      const html = await render(
        createElement(BookingRequestEmail, {
          customerName: data.customerName,
          serviceName: data.serviceName,
          scheduledAt: when,
          amount,
        }),
      );
      const text = `${data.customerName} requested ${data.serviceName} on ${when} (${amount}). Open Sliik to confirm or decline.`;
      await this.send({ to, subject: 'New booking request', html, text });
    } catch (error) {
      this.logger.error('Failed to send booking-request email', error as Error);
    }
  }

  async sendBookingConfirmed(
    customerUserId: string,
    data: BookingConfirmedData,
  ): Promise<void> {
    try {
      const to = await this.resolveEmail(customerUserId);
      if (!to) return;
      const when = this.formatDateTime(data.scheduledAt);
      const amount = this.formatAmount(data.amount);
      const html = await render(
        createElement(BookingConfirmedEmail, {
          providerName: data.providerName,
          serviceName: data.serviceName,
          scheduledAt: when,
          amount,
        }),
      );
      const text = `${data.providerName} confirmed your booking for ${data.serviceName} on ${when} (${amount}).`;
      await this.send({
        to,
        subject: 'Your booking is confirmed',
        html,
        text,
      });
    } catch (error) {
      this.logger.error(
        'Failed to send booking-confirmed email',
        error as Error,
      );
    }
  }

  async sendBookingDeclined(
    customerUserId: string,
    data: BookingDeclinedData,
  ): Promise<void> {
    try {
      const to = await this.resolveEmail(customerUserId);
      if (!to) return;
      const html = await render(
        createElement(BookingDeclinedEmail, {
          providerName: data.providerName,
          serviceName: data.serviceName,
        }),
      );
      const text = `${data.providerName} declined your request for ${data.serviceName}. Find another time or provider in the app.`;
      await this.send({
        to,
        subject: 'Your booking request was declined',
        html,
        text,
      });
    } catch (error) {
      this.logger.error(
        'Failed to send booking-declined email',
        error as Error,
      );
    }
  }

  async sendBookingCancelled(
    recipientUserId: string,
    data: BookingCancelledData,
  ): Promise<void> {
    try {
      const to = await this.resolveEmail(recipientUserId);
      if (!to) return;
      const when = this.formatDateTime(data.scheduledAt);
      const html = await render(
        createElement(BookingCancelledEmail, {
          cancellerName: data.cancellerName,
          serviceName: data.serviceName,
          scheduledAt: when,
        }),
      );
      const text = `${data.cancellerName} cancelled the booking for ${data.serviceName} on ${when}. The slot is free again.`;
      await this.send({
        to,
        subject: 'Your booking was cancelled',
        html,
        text,
      });
    } catch (error) {
      this.logger.error(
        'Failed to send booking-cancelled email',
        error as Error,
      );
    }
  }

  async sendPaymentReceipt(
    customerUserId: string,
    data: PaymentReceiptData,
  ): Promise<void> {
    try {
      const to = await this.resolveEmail(customerUserId);
      if (!to) return;
      const amount = this.formatAmount(data.amount);
      const html = await render(
        createElement(PaymentReceiptEmail, {
          providerName: data.providerName,
          serviceName: data.serviceName,
          amount,
          reference: data.reference,
        }),
      );
      const text = `Payment of ${amount} for ${data.serviceName} with ${data.providerName} was successful. Reference: ${data.reference}.`;
      await this.send({ to, subject: 'Payment receipt', html, text });
    } catch (error) {
      this.logger.error('Failed to send payment-receipt email', error as Error);
    }
  }

  private async resolveEmail(userId: string): Promise<string | null> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true, isActive: true },
    });
    if (!user || !user.isActive) return null;
    return user.email;
  }

  private formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  private formatAmount(amount: number | string): string {
    return `₦${Number(amount).toLocaleString('en-NG')}`;
  }

  private async send(opts: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }) {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        attachments: [
          {
            filename: 'sliik-mark.png',
            path: this.logoPath,
            cid: 'sliik-mark',
          },
        ],
      });
    } catch (error) {
      this.logger.error(
        `Failed to send "${opts.subject}" to ${opts.to}`,
        error as Error,
      );
    }
  }
}
