import { validateEnv } from '@infrastructure/config/env';
import { OutboxModule } from '@infrastructure/outbox/outbox.module';
import { PersistenceModule } from '@infrastructure/persistence/prisma/persistence.module';
import { RedisModule } from '@infrastructure/redis/redis.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppExceptionFilter } from '@presentation/http/filters/app-exception.filter';
import { HealthController } from '@presentation/http/health/health.controller';
import { PaymentController } from '@presentation/http/payment/payment.controller';
import { MercadoPagoWebhookController } from '@presentation/http/webhook/mercado-pago-webhook.controller';
import { PaymentModule } from './modules/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PersistenceModule,
    RedisModule,
    PaymentModule,
    OutboxModule,
  ],
  controllers: [PaymentController, MercadoPagoWebhookController, HealthController],
  providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
})
export class AppModule {}
