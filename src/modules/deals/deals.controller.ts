import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { ClaimDealDto } from './dto/claim-deal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';

@Controller('deals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DealsController {
  constructor(private dealsService: DealsService) {}

  @Post()
  @Roles('provider')
  async createDeal(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDealDto,
  ) {
    const data = await this.dealsService.createDeal(user.id, dto);
    return successResponse('Deal created', data);
  }

  @Get()
  @Roles('customer', 'provider')
  async getActiveDeals() {
    const data = await this.dealsService.getActiveDeals();
    return successResponse('Active deals fetched', data);
  }

  @Get('mine')
  @Roles('provider')
  async getMyDeals(@CurrentUser() user: AuthUser) {
    const data = await this.dealsService.getMyDeals(user.id);
    return successResponse('Your deals fetched', data);
  }

  @Get(':id')
  @Roles('customer', 'provider')
  async getDealById(@Param('id') id: string) {
    const data = await this.dealsService.getDealById(id);
    return successResponse('Deal fetched', data);
  }

  @Patch(':id')
  @Roles('provider')
  async updateDeal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
  ) {
    const data = await this.dealsService.updateDeal(user.id, id, dto);
    return successResponse('Deal updated', data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('provider')
  async deleteDeal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    await this.dealsService.deleteDeal(user.id, id);
    return successResponse('Deal deleted');
  }

  @Post(':id/claim')
  @Roles('customer')
  async claimDeal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ClaimDealDto,
  ) {
    const data = await this.dealsService.claimDeal(user.id, id, dto);
    return successResponse('Deal claimed, booking created', data);
  }
}
