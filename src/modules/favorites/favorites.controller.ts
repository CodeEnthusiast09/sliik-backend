import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';

@Controller('favorites')
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Post(':providerId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async addFavorite(
    @CurrentUser() user: AuthUser,
    @Param('providerId') providerId: string,
  ) {
    await this.favoritesService.addFavorite(user.id, providerId);
    return successResponse('Provider added to favorites');
  }

  @Delete(':providerId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @HttpCode(HttpStatus.OK)
  async removeFavorite(
    @CurrentUser() user: AuthUser,
    @Param('providerId') providerId: string,
  ) {
    await this.favoritesService.removeFavorite(user.id, providerId);
    return successResponse('Provider removed from favorites');
  }

  @Get(':providerId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async getFavoriteStatus(
    @CurrentUser() user: AuthUser,
    @Param('providerId') providerId: string,
  ) {
    const isFavorited = await this.favoritesService.isFavorited(
      user.id,
      providerId,
    );
    return successResponse('Favorite status fetched', { isFavorited });
  }
}
