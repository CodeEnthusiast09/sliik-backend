import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { createElement } from 'react';
import { PasswordResetEmail } from './emails/password-reset';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private config: ConfigService) {
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
      });
    } catch (error) {
      this.logger.error(
        `Failed to send "${opts.subject}" to ${opts.to}`,
        error as Error,
      );
      throw error;
    }
  }
}
