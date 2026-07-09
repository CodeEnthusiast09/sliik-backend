import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async deleteMe(@CurrentUser() user: AuthUser, @Body() dto: DeleteAccountDto) {
    await this.usersService.deleteAccount(user.id, dto.password);
    return successResponse('Your account has been deleted');
  }
}
