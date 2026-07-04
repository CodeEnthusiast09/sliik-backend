import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { AuthModule } from '../auth/auth.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [AuthModule, PayoutsModule, ProvidersModule],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
