import {
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  Max,
  Min,
} from 'class-validator';

export class UpdateProviderProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tradeType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  yearsExperience?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
