import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, HttpModule],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
