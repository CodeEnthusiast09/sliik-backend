import { IsUUID } from 'class-validator';

export class ConversationRoomDto {
  @IsUUID()
  bookingId: string;
}
