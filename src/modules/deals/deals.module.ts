import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { AuthModule } from '../auth/auth.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { ProvidersModule } from '../providers/providers.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, PayoutsModule, ProvidersModule, NotificationsModule],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
