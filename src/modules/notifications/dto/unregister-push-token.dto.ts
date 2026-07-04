import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UnregisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  expoPushToken: string;
}
