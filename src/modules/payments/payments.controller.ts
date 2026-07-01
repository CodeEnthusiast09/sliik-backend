import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async initiatePayment(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitiatePaymentDto,
  ) {
    const data = await this.paymentsService.initiatePayment(user.id, dto);
    return successResponse('Payment initiated', data);
  }

  @Post('webhook/stripe')
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    await this.paymentsService.handleStripeWebhook(req.rawBody!, signature);
    return { received: true };
  }

  @Post('webhook/paystack')
  async paystackWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
  ) {
    await this.paymentsService.handlePaystackWebhook(req.rawBody!, signature);
    return { received: true };
  }
}
