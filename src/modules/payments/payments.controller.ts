import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaystackWebhookGuard } from '../../common/guards/paystack-webhook.guard';
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

  @Post('webhook/paystack')
  @UseGuards(PaystackWebhookGuard)
  async paystackWebhook(@Body() payload: Record<string, unknown>) {
    await this.paymentsService.handlePaystackWebhook(payload);
    return { received: true };
  }
}
