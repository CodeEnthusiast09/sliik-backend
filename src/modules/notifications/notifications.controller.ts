import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UnregisterPushTokenDto } from './dto/unregister-push-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import {
  successResponse,
  paginatedResponse,
} from '../../common/utils/response.helper';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @Roles('customer', 'provider')
  async getMyNotifications(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationsQueryDto,
  ) {
    const { notifications, meta } =
      await this.notificationsService.getMyNotifications(user.id, query);
    return paginatedResponse('Notifications fetched', notifications, meta);
  }

  @Get('unread-count')
  @Roles('customer', 'provider')
  async getUnreadCount(@CurrentUser() user: AuthUser) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return successResponse('Unread count fetched', { count });
  }

  @Patch(':id/read')
  @Roles('customer', 'provider')
  async markAsRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const data = await this.notificationsService.markAsRead(user.id, id);
    return successResponse('Notification marked as read', data);
  }

  @Patch('read-all')
  @Roles('customer', 'provider')
  async markAllAsRead(@CurrentUser() user: AuthUser) {
    await this.notificationsService.markAllAsRead(user.id);
    return successResponse('All notifications marked as read');
  }

  @Post('push-tokens')
  @Roles('customer', 'provider')
  async registerPushToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterPushTokenDto,
  ) {
    await this.notificationsService.registerPushToken(
      user.id,
      dto.expoPushToken,
      dto.platform,
    );
    return successResponse('Push token registered');
  }

  @Delete('push-tokens')
  @Roles('customer', 'provider')
  async unregisterPushToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: UnregisterPushTokenDto,
  ) {
    await this.notificationsService.unregisterPushToken(
      user.id,
      dto.expoPushToken,
    );
    return successResponse('Push token unregistered');
  }
}
