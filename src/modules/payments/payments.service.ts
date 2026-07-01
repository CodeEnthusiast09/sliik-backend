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

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DRIZZLE) private db: Db,
    private config: ConfigService,
    private http: HttpService,
  ) {}

  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
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
    });
    if (existing && existing.status === 'pending') {
      throw new BadRequestException(
        'A payment is already pending for this booking',
      );
    }

    return this.initiatePaystack(booking, customer.fullName, dto.bookingId);
  }

  private async initiatePaystack(
    booking: { id: string; totalAmount: string; providerId: string },
    customerName: string,
    bookingId: string,
  ) {
    const amountInKobo = Math.round(parseFloat(booking.totalAmount) * 100);
    const reference = `sliik_${bookingId}_${Date.now()}`;

    const { data } = await firstValueFrom(
      this.http.post(
        'https://api.paystack.co/transaction/initialize',
        {
          amount: amountInKobo,
          currency: 'NGN',
          reference,
          metadata: { bookingId, customerName },
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
    }
  }
}
