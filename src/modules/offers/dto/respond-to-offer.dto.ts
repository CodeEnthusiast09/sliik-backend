import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class RespondToOfferDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  offeredPrice: number;

  @IsString()
  @IsOptional()
  message?: string;
}
