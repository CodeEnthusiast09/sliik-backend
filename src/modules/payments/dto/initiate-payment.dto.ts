import { IsEnum, IsUUID } from 'class-validator';

export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYSTACK = 'paystack',
}

export class InitiatePaymentDto {
  @IsUUID()
  bookingId: string;

  @IsEnum(PaymentProvider)
  provider: PaymentProvider;
}
