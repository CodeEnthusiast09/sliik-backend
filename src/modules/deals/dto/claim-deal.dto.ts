import { IsDateString } from 'class-validator';

export class ClaimDealDto {
  @IsDateString()
  scheduledAt: string;
}
