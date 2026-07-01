import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { SetScheduleDto } from './dto/set-schedule.dto';
import { AddDayOffDto } from './dto/add-day-off.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';

@Controller('availability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('provider')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Put('schedule')
  async setSchedule(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetScheduleDto,
  ) {
    const data = await this.availabilityService.setSchedule(user.id, dto);
    return successResponse('Schedule updated', data);
  }

  @Get('schedule')
  async getSchedule(@CurrentUser() user: AuthUser) {
    const data = await this.availabilityService.getSchedule(user.id);
    return successResponse('Schedule fetched', data);
  }

  @Post('days-off')
  async addDayOff(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddDayOffDto,
  ) {
    const data = await this.availabilityService.addDayOff(user.id, dto);
    return successResponse('Day off added', data);
  }

  @Get('days-off')
  async getDaysOff(@CurrentUser() user: AuthUser) {
    const data = await this.availabilityService.getDaysOff(user.id);
    return successResponse('Days off fetched', data);
  }

  @Delete('days-off/:id')
  @HttpCode(HttpStatus.OK)
  async removeDayOff(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    await this.availabilityService.removeDayOff(user.id, id);
    return successResponse('Day off removed');
  }
}
