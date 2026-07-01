import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { AuthModule } from '../auth/auth.module';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [AuthModule, PayoutsModule],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
