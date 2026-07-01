import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { CreatePayoutAccountDto } from './dto/create-payout-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';

@Controller('payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayoutsController {
  constructor(private payoutsService: PayoutsService) {}

  @Get('banks')
  @Roles('provider')
  async getBankList() {
    const data = await this.payoutsService.getBankList();
    return successResponse('Banks fetched', data);
  }

  @Get('me')
  @Roles('provider')
  async getMyPayoutAccount(@CurrentUser() user: AuthUser) {
    const data = await this.payoutsService.getMyPayoutAccount(user.id);
    return successResponse('Payout account fetched', data);
  }

  @Post()
  @Roles('provider')
  async createPayoutAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePayoutAccountDto,
  ) {
    const data = await this.payoutsService.createPayoutAccount(user.id, dto);
    return successResponse('Payout account created', data);
  }
}
