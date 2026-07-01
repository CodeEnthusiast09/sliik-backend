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
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';

@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('provider')
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  @Post()
  async createService(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateServiceDto,
  ) {
    const data = await this.servicesService.createService(user.id, dto);
    return successResponse('Service created', data);
  }

  @Get()
  async getMyServices(@CurrentUser() user: AuthUser) {
    const data = await this.servicesService.getMyServices(user.id);
    return successResponse('Services fetched', data);
  }

  @Patch(':id')
  async updateService(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    const data = await this.servicesService.updateService(user.id, id, dto);
    return successResponse('Service updated', data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteService(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    await this.servicesService.deleteService(user.id, id);
    return successResponse('Service deactivated');
  }
}
