import { IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class AppleAuthDto {
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @IsEnum(['customer', 'provider'])
  role: 'customer' | 'provider';

  @IsString()
  @IsOptional()
  fullName?: string;
}
