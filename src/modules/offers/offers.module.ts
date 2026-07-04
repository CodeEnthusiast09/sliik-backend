import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { AuthModule } from '../auth/auth.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, PayoutsModule, NotificationsModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
