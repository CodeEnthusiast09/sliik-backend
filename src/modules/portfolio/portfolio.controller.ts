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
import { PortfolioService } from './portfolio.service';
import { CreatePortfolioItemDto } from './dto/create-portfolio-item.dto';
import { ReorderPortfolioDto } from './dto/reorder-portfolio.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';

@Controller('portfolio')
export class PortfolioController {
  constructor(private portfolioService: PortfolioService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('provider')
  async addItem(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePortfolioItemDto,
  ) {
    const data = await this.portfolioService.addItem(user.id, dto);
    return successResponse('Portfolio item added', data);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('provider')
  async getMyPortfolio(@CurrentUser() user: AuthUser) {
    const data = await this.portfolioService.getMyPortfolio(user.id);
    return successResponse('Portfolio fetched', data);
  }

  @Get('provider/:providerId')
  async getProviderPortfolio(@Param('providerId') providerId: string) {
    const data = await this.portfolioService.getProviderPortfolio(providerId);
    return successResponse('Portfolio fetched', data);
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('provider')
  async reorder(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderPortfolioDto,
  ) {
    await this.portfolioService.reorder(user.id, dto);
    return successResponse('Portfolio reordered');
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('provider')
  @HttpCode(HttpStatus.OK)
  async deleteItem(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.portfolioService.deleteItem(user.id, id);
    return successResponse('Portfolio item deleted');
  }
}
