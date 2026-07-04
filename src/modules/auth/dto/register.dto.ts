import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(['customer', 'provider'])
  role: 'customer' | 'provider';

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ValidateIf((o) => o.role === 'provider')
  @IsString()
  @IsNotEmpty()
  tradeType?: string;
}
