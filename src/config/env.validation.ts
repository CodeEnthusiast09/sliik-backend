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

  @IsString()
  @IsNotEmpty()
  APPLE_CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  STRIPE_SECRET_KEY: string;

  @IsString()
  @IsNotEmpty()
  STRIPE_WEBHOOK_SECRET: string;

  @IsString()
  @IsNotEmpty()
  PAYSTACK_SECRET_KEY: string;

  @IsString()
  @IsNotEmpty()
  PAYMENT_SUCCESS_URL: string;

  @IsString()
  @IsNotEmpty()
  PAYMENT_CANCEL_URL: string;
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
