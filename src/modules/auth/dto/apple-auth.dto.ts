import { IsIn, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class AppleAuthDto {
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @IsIn(['customer'])
  role: 'customer';

  @IsString()
  @IsOptional()
  fullName?: string;
}
