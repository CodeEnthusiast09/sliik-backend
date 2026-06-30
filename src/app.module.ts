import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    AuthModule,
  ],
})
export class AppModule {}
