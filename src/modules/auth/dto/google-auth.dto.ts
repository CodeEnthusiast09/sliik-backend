import { IsEnum, IsString, IsNotEmpty } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsEnum(['customer', 'provider'])
  role: 'customer' | 'provider';
}
