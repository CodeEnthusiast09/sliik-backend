import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { RespondToOfferDto } from './dto/respond-to-offer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { successResponse } from '../../common/utils/response.helper';

@Controller('offers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OffersController {
  constructor(private offersService: OffersService) { }

  @Post()
  @Roles('customer')
  async createOffer(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOfferDto,
  ) {
    const data = await this.offersService.createOffer(user.id, dto);
    return successResponse('Offer created', data);
  }

  @Get()
  @Roles('customer')
  async getMyOffers(@CurrentUser() user: AuthUser) {
    const data = await this.offersService.getMyOffers(user.id);
    return successResponse('Offers fetched', data);
  }

  @Get('open')
  @Roles('provider')
  async getOpenOffers(@CurrentUser() user: AuthUser) {
    const data = await this.offersService.getOpenOffers(user.id);
    return successResponse('Open offers fetched', data);
  }

  // /responses/mine must come before /:id to avoid being matched as an id
  @Get('responses/mine')
  @Roles('provider')
  async getMyResponses(@CurrentUser() user: AuthUser) {
    const data = await this.offersService.getMyResponses(user.id);
    return successResponse('Responses fetched', data);
  }

  @Get(':id')
  @Roles('customer', 'provider')
  async getOfferById(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const data = await this.offersService.getOfferById(user.id, user.role, id);
    return successResponse('Offer fetched', data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('customer')
  async cancelOffer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const data = await this.offersService.cancelOffer(user.id, id);
    return successResponse('Offer cancelled', data);
  }

  @Post(':id/respond')
  @Roles('provider')
  async respondToOffer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RespondToOfferDto,
  ) {
    const data = await this.offersService.respondToOffer(user.id, id, dto);
    return successResponse('Response submitted', data);
  }

  @Post(':id/responses/:responseId/accept')
  @Roles('customer')
  async acceptResponse(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('responseId') responseId: string,
  ) {
    const data = await this.offersService.acceptResponse(user.id, id, responseId);
    return successResponse('Response accepted, booking created', data);
  }
}
