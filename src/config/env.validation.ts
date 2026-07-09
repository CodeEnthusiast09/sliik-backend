import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(65535)
  PORT?: number;

  @IsString()
  @IsNotEmpty()
  ALLOWED_ORIGINS: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRY: string;

  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_ID: string;

  // Deferred until sliik-mobile is scaffolded and a Bundle ID is chosen -
  // Apple Sign-In's client ID is inherently tied to that decision.
  @IsOptional()
  @IsString()
  APPLE_CLIENT_ID?: string;

  @IsString()
  @IsNotEmpty()
  PAYSTACK_SECRET_KEY: string;

  @IsString()
  @IsNotEmpty()
  PAYMENT_SUCCESS_URL: string;

  @IsString()
  @IsNotEmpty()
  PAYMENT_CANCEL_URL: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  PLATFORM_COMMISSION_PERCENT?: number;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_CLOUD_NAME: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_API_SECRET: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  MAX_UPLOAD_SIZE_MB?: number;

  @IsString()
  @IsNotEmpty()
  MAIL_HOST: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(65535)
  MAIL_PORT?: number;

  @IsOptional()
  @IsString()
  MAIL_SECURE?: string;

  @IsString()
  @IsNotEmpty()
  MAIL_USER: string;

  @IsString()
  @IsNotEmpty()
  MAIL_PASSWORD: string;

  @IsOptional()
  @IsString()
  MAIL_FROM_NAME?: string;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM_ADDRESS: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  PASSWORD_RESET_CODE_EXPIRY_MINUTES?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  PASSWORD_RESET_MAX_ATTEMPTS?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  PASSWORD_RESET_RESEND_COOLDOWN_SECONDS?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  THROTTLE_TTL_SECONDS?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  THROTTLE_LIMIT?: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
