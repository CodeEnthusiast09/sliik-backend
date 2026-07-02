import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    MulterModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize:
            config.getOrThrow<number>('uploads.maxSizeMb') * 1024 * 1024,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
