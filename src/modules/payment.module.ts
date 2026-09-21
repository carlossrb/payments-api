import { CreateCheckoutUseCase } from '@application/payment/use-cases/create-checkout.use-case';
import { CreatePaymentUseCase } from '@application/payment/use-cases/create-payment.use-case';
import { GetPaymentUseCase } from '@application/payment/use-cases/get-payment.use-case';
import { ListPaymentsUseCase } from '@application/payment/use-cases/list-payments.use-case';
import { ReceiveGatewayNotificationUseCase } from '@application/payment/use-cases/receive-gateway-notification.use-case';
import { SettlePaymentUseCase } from '@application/payment/use-cases/settle-payment.use-case';
import { SyncGatewayNotificationUseCase } from '@application/payment/use-cases/sync-gateway-notification.use-case';
import { UpdatePaymentUseCase } from '@application/payment/use-cases/update-payment.use-case';
import { MercadoPagoModule } from '@infrastructure/mercado-pago/mercado-pago.module';
import { PersistenceModule } from '@infrastructure/persistence/prisma/persistence.module';
import { RedisModule } from '@infrastructure/redis/redis.module';
import { TemporalClientModule } from '@infrastructure/temporal/temporal-client.module';
import { Module } from '@nestjs/common';

const USE_CASES = [
  CreatePaymentUseCase,
  GetPaymentUseCase,
  ListPaymentsUseCase,
  UpdatePaymentUseCase,
  CreateCheckoutUseCase,
  SettlePaymentUseCase,
  ReceiveGatewayNotificationUseCase,
  SyncGatewayNotificationUseCase,
];

@Module({
  imports: [PersistenceModule, RedisModule, MercadoPagoModule, TemporalClientModule],
  providers: USE_CASES,
  exports: USE_CASES,
})
export class PaymentModule {}
