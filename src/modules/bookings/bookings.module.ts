import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { AuthModule } from '../auth/auth.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { ProvidersModule } from '../providers/providers.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, PayoutsModule, ProvidersModule, NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
