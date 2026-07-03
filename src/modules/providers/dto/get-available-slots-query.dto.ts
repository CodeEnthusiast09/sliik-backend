import { IsDateString, IsUUID } from 'class-validator';

export class GetAvailableSlotsQueryDto {
  @IsDateString()
  date: string;

  @IsUUID()
  serviceId: string;
}
