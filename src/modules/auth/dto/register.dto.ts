import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

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

  @ValidateIf((o: RegisterDto) => o.role === 'provider')
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  tradeType?: string;
}
