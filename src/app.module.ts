import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { DbModule } from './db';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { ServicesModule } from './modules/services/services.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { OffersModule } from './modules/offers/offers.module';
import { DealsModule } from './modules/deals/deals.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate }),
    DbModule,
    AuthModule,
    CustomersModule,
    ProvidersModule,
    ServicesModule,
    AvailabilityModule,
    BookingsModule,
    PaymentsModule,
    PayoutsModule,
    OffersModule,
    DealsModule,
    ReviewsModule,
    ChatModule,
    NotificationsModule,
  ],
})
export class AppModule {}
