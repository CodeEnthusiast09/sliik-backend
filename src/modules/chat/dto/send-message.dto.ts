import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
