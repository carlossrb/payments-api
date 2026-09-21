import { validateEnv } from '@infrastructure/config/env';
import { MercadoPagoModule } from '@infrastructure/mercado-pago/mercado-pago.module';
import { CreditCardPaymentActivities } from '@infrastructure/temporal/activities/credit-card-payment.activities';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentModule } from './modules/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PaymentModule,
    MercadoPagoModule,
  ],
  providers: [CreditCardPaymentActivities],
})
export class WorkerModule {}
