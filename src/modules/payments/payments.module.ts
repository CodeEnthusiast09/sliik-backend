import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AuthModule } from '../auth/auth.module';
import { PaystackWebhookGuard } from '../../common/guards/paystack-webhook.guard';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [AuthModule, HttpModule, PayoutsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaystackWebhookGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}
