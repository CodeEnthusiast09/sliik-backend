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
import Stripe from 'stripe';
import { firstValueFrom } from 'rxjs';
import { DRIZZLE } from '../../db';
import * as schema from '../../db/schema';
import { bookings, customerProfiles, payments } from '../../db/schema';
import {
  InitiatePaymentDto,
  PaymentProvider,
} from './dto/initiate-payment.dto';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class PaymentsService {
  private _stripe: Stripe | null = null;

  constructor(
    @Inject(DRIZZLE) private db: Db,
    private config: ConfigService,
    private http: HttpService,
  ) {}

  private get stripe(): Stripe {
    if (!this._stripe) {
      this._stripe = new Stripe(
        this.config.getOrThrow<string>('stripe.secretKey'),
      );
    }
    return this._stripe;
  }

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

    if (dto.provider === PaymentProvider.STRIPE) {
      return this.initiateStripe(booking, dto.bookingId);
    }
    return this.initiatePaystack(booking, customer.fullName, dto.bookingId);
  }

  private async initiateStripe(
    booking: { id: string; totalAmount: string },
    bookingId: string,
  ) {
    const amountInKobo = Math.round(parseFloat(booking.totalAmount) * 100);

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'ngn',
            unit_amount: amountInKobo,
            product_data: { name: 'Sliik Booking' },
          },
          quantity: 1,
        },
      ],
      metadata: { bookingId },
      success_url: `${this.config.getOrThrow('payment.successUrl')}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: this.config.getOrThrow('payment.cancelUrl'),
    });

    await this.db.insert(payments).values({
      bookingId,
      amount: booking.totalAmount,
      currency: 'NGN',
      provider: 'stripe',
      reference: session.id,
      status: 'pending',
    });

    return { checkoutUrl: session.url, reference: session.id };
  }

  private async initiatePaystack(
    booking: { id: string; totalAmount: string },
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

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.config.getOrThrow<string>(
      'stripe.webhookSecret',
    );

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await this.markPaymentSuccess(
        session.id,
        'stripe',
        session.metadata?.bookingId,
      );
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      await this.markPaymentFailed(session.id);
    }
  }

  async handlePaystackWebhook(payload: Record<string, unknown>) {
    if (payload['event'] === 'charge.success') {
      const data = payload['data'] as Record<string, unknown>;
      const reference = data['reference'] as string;
      const meta = data['metadata'] as Record<string, unknown>;
      await this.markPaymentSuccess(
        reference,
        'paystack',
        meta?.['bookingId'] as string,
      );
    }
  }

  private async markPaymentSuccess(
    reference: string,
    provider: string,
    bookingId?: string,
  ) {
    await this.db
      .update(payments)
      .set({ status: 'success' })
      .where(eq(payments.reference, reference));

    if (bookingId) {
      await this.db
        .update(bookings)
        .set({
          paymentStatus: 'paid',
          paymentProvider: provider as 'stripe' | 'paystack',
          paymentReference: reference,
        })
        .where(eq(bookings.id, bookingId));
    }
  }

  private async markPaymentFailed(reference: string) {
    await this.db
      .update(payments)
      .set({ status: 'failed' })
      .where(eq(payments.reference, reference));
  }
}
