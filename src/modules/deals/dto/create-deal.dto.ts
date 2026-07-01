import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateDealDto {
  @IsUUID()
  serviceId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsPositive()
  originalPrice: number;

  @IsNumber()
  @IsPositive()
  dealPrice: number;

  @IsNumber()
  @Min(1)
  slotsTotal: number;

  @IsDateString()
  expiresAt: string;
}
