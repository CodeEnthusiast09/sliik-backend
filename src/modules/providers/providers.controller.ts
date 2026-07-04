import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { UpdateProviderProfileDto } from './dto/update-provider-profile.dto';
import { FindProvidersQueryDto } from './dto/find-providers-query.dto';
import { GetAvailableSlotsQueryDto } from './dto/get-available-slots-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import {
  successResponse,
  paginatedResponse,
} from '../../common/utils/response.helper';

@Controller('providers')
export class ProvidersController {
  constructor(private providersService: ProvidersService) {}

  @Get()
  async findProviders(@Query() query: FindProvidersQueryDto) {
    const { providers, meta } =
      await this.providersService.findProviders(query);
    return paginatedResponse('Providers fetched', providers, meta);
  }

  // /me must come before /:id to avoid being matched as an id
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('provider')
  async getMyProfile(@CurrentUser() user: AuthUser) {
    const data = await this.providersService.getMyProfile(user.id);
    return successResponse('Profile fetched', data);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('provider')
  async updateMyProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProviderProfileDto,
  ) {
    const data = await this.providersService.updateMyProfile(user.id, dto);
    return successResponse('Profile updated', data);
  }

  // /:id/slots must come before /:id to avoid being matched as an id
  @Get(':id/slots')
  async getAvailableSlots(
    @Param('id') id: string,
    @Query() query: GetAvailableSlotsQueryDto,
  ) {
    const data = await this.providersService.getAvailableSlots(id, query);
    return successResponse('Available slots fetched', data);
  }

  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    const data = await this.providersService.getPublicProfile(id);
    return successResponse('Provider profile fetched', data);
  }
}
