import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { ExpoPushService } from './expo-push.service';
import { BookingRemindersScheduler } from './booking-reminders.scheduler';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    ExpoPushService,
    BookingRemindersScheduler,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
