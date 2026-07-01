import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // Raw body needed for Stripe webhook signature verification
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Parse JSON for all routes except webhook paths that need raw body
  app.use('/api/payments/webhook/stripe', json({ type: 'application/json' }));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const config = app.get(ConfigService);
  const allowedOrigins = config
    .getOrThrow<string>('ALLOWED_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
