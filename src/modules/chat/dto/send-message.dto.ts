import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
