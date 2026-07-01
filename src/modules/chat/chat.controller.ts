import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('conversations')
  @Roles('customer', 'provider')
  async getMyConversations(@CurrentUser() user: AuthUser) {
    const data = await this.chatService.getMyConversations(user.id, user.role);
    return successResponse('Conversations fetched', data);
  }

  @Get('booking/:bookingId/messages')
  @Roles('customer', 'provider')
  async getMessages(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
  ) {
    const data = await this.chatService.getMessages(user.id, bookingId);
    return successResponse('Messages fetched', data);
  }

  @Patch('booking/:bookingId/read')
  @Roles('customer', 'provider')
  async markRead(
    @CurrentUser() user: AuthUser,
    @Param('bookingId') bookingId: string,
  ) {
    await this.chatService.markMessagesRead(user.id, bookingId);
    return successResponse('Messages marked as read');
  }
}
