import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOfferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  serviceType: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  budget?: number;

  @IsDateString()
  preferredFrom: string;

  @IsDateString()
  preferredTo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;
} 
