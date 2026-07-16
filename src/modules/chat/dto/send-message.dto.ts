import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsIn(['text', 'image', 'audio'])
  type?: 'text' | 'image' | 'audio';

  // Required (non-empty) for a plain text message; an image message can
  // send an empty caption, so it's only validated when there's no mediaUrl.
  @ValidateIf((dto: SendMessageDto) => !dto.mediaUrl)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  // Echoed back verbatim on the broadcast, never persisted - lets the
  // sender's own client reconcile this against the optimistic bubble it
  // already rendered before the round trip, instead of appending a duplicate.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientId?: string;
}
