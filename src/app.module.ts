import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
  ],
})
export class AppModule {}
