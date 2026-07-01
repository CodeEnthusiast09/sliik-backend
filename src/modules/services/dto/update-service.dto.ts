import { IsBoolean, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class UpdateServiceDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  durationMinutes?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
