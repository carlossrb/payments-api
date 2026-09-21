import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentModule } from '../../modules/payment.module';
import { PersistenceModule } from '../persistence/prisma/persistence.module';
import { RedisModule } from '../redis/redis.module';
import { TemporalClientModule } from '../temporal/temporal-client.module';
import { StartCreditCardPaymentHandler } from './handlers/start-credit-card-payment.handler';
import { SyncGatewayNotificationHandler } from './handlers/sync-gateway-notification.handler';
import { OutboxProcessor } from './outbox.processor';
import { OUTBOX_HANDLERS } from './outbox-handler';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PaymentModule,
    PersistenceModule,
    RedisModule,
    TemporalClientModule,
  ],
  providers: [
    StartCreditCardPaymentHandler,
    SyncGatewayNotificationHandler,
    {
      provide: OUTBOX_HANDLERS,
      inject: [StartCreditCardPaymentHandler, SyncGatewayNotificationHandler],
      useFactory: (
        startCreditCardPayment: StartCreditCardPaymentHandler,
        syncGatewayNotification: SyncGatewayNotificationHandler,
      ) => [startCreditCardPayment, syncGatewayNotification],
    },
    OutboxProcessor,
  ],
})
export class OutboxModule {}
