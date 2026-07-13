import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReportDto {
  @IsUUID()
  reportedUserId: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
