import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: AuthUser) {
    const data = await this.customersService.getProfile(user.id);
    return successResponse('Profile fetched', data);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    const data = await this.customersService.updateProfile(user.id, dto);
    return successResponse('Profile updated', data);
  }
}
