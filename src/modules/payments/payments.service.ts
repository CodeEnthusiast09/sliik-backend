import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { firstValueFrom } from 'rxjs';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { bookings, customerProfiles, payments } from '../../db/schema';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PayoutsService } from '../payouts/payouts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DRIZZLE) private db: Db,
    private config: ConfigService,
    private http: HttpService,
    private payoutsService: PayoutsService,
    private notificationsService: NotificationsService,
    private mail: MailService,
  ) {}

  async initiatePayment(
    userId: string,
    email: string,
    dto: InitiatePaymentDto,
  ) {
    const customer = await this.db.query.customerProfiles.findFirst({
      where: eq(customerProfiles.userId, userId),
    });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const booking = await this.db.query.bookings.findFirst({
      where: eq(bookings.id, dto.bookingId),
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== customer.id)
      throw new ForbiddenException('Not your booking');
    if (booking.paymentStatus === 'paid')
      throw new BadRequestException('Booking is already paid');

    const existing = await this.db.query.payments.findFirst({
      where: eq(payments.bookingId, dto.bookingId),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
    if (existing && existing.status === 'pending') {
      // Don't just trust our own stale 'pending' row - Paystack never tells us
      // about an abandoned or failed checkout unless charge.failed happens to
      // fire, so ask Paystack directly rather than blocking retries forever.
      const isPaid = await this.verifyAndSyncPayment(
        existing.reference,
        dto.bookingId,
      );
      if (isPaid) {
        throw new BadRequestException('Booking is already paid');
      }
    }

    return this.initiatePaystack(
      booking,
      email,
      customer.fullName,
      dto.bookingId,
    );
  }

  private async initiatePaystack(
    booking: { id: string; totalAmount: string; providerId: string },
    email: string,
    customerName: string,
    bookingId: string,
  ) {
    const payoutAccount = await this.payoutsService.assertProviderPayable(
      booking.providerId,
    );

    const amountInKobo = Math.round(parseFloat(booking.totalAmount) * 100);
    const reference = `sliik_${bookingId}_${Date.now()}`;

    const { data } = await firstValueFrom(
      this.http.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email,
          amount: amountInKobo,
          currency: 'NGN',
          reference,
          metadata: { bookingId, customerName },
          subaccount: payoutAccount.paystackSubaccountCode,
          callback_url: this.config.getOrThrow('payment.successUrl'),
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.getOrThrow('paystack.secretKey')}`,
          },
        },
      ),
    );

    await this.db.insert(payments).values({
      bookingId,
      amount: booking.totalAmount,
      currency: 'NGN',
      provider: 'paystack',
      reference,
      status: 'pending',
    });

    return { checkoutUrl: data.data.authorization_url, reference };
  }

  async handlePaystackWebhook(payload: Record<string, unknown>) {
    if (payload['event'] === 'charge.success') {
      const data = payload['data'] as Record<string, unknown>;
      const reference = data['reference'] as string;
      const meta = data['metadata'] as Record<string, unknown>;
      await this.markPaymentSuccess(reference, meta?.['bookingId'] as string);
    } else if (payload['event'] === 'charge.failed') {
      const data = payload['data'] as Record<string, unknown>;
      const reference = data['reference'] as string;
      await this.markPaymentFailed(reference);
    }
  }

  private async markPaymentSuccess(reference: string, bookingId?: string) {
    await this.db
      .update(payments)
      .set({ status: 'success' })
      .where(eq(payments.reference, reference));

    if (bookingId) {
      await this.db
        .update(bookings)
        .set({
          paymentStatus: 'paid',
          paymentProvider: 'paystack',
          paymentReference: reference,
        })
        .where(eq(bookings.id, bookingId));

      const booking = await this.db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: { customer: true, provider: true, service: true },
      });
      if (booking) {
        await this.notificationsService.create(
          booking.provider.userId,
          'payment_received',
          'Payment received',
          `${booking.customer.fullName} paid ₦${booking.totalAmount} for their booking`,
          { bookingId },
        );
        await this.notificationsService.create(
          booking.customer.userId,
          'payment_sent',
          'Payment successful',
          `Your payment of ₦${booking.totalAmount} was successful`,
          { bookingId },
        );
        void this.mail.sendPaymentReceipt(booking.customer.userId, {
          providerName: booking.provider.fullName,
          serviceName: booking.service?.name ?? 'Sliik Deal',
          amount: booking.totalAmount,
          reference,
        });
      }
    }
  }

  private async markPaymentFailed(reference: string) {
    await this.db
      .update(payments)
      .set({ status: 'failed' })
      .where(eq(payments.reference, reference));
  }

  // Asks Paystack directly whether a 'pending' payment row actually went
  // through - covers both a failed/abandoned checkout (no webhook ever
  // fires for pure abandonment) and a lost/delayed webhook for a real
  // success, rather than trusting our own possibly-stale row.
  private async verifyAndSyncPayment(
    reference: string,
    bookingId: string,
  ): Promise<boolean> {
    const { data } = await firstValueFrom(
      this.http.get(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${this.config.getOrThrow('paystack.secretKey')}`,
        },
      }),
    );

    if (data.data.status === 'success') {
      await this.markPaymentSuccess(reference, bookingId);
      return true;
    }

    await this.markPaymentFailed(reference);
    return false;
  }
}
