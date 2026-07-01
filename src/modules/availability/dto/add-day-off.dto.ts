import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddDayOffDto {
  @IsDateString()
  date: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}
