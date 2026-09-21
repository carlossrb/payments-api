import { PAYMENT_ORCHESTRATOR } from '@application/payment/ports/payment-orchestrator';
import type { EnvironmentVariables } from '@infrastructure/config/env';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Connection } from '@temporalio/client';
import { TEMPORAL_CLIENT } from './temporal.const';
import { TemporalPaymentOrchestrator } from './temporal-payment.orchestrator';

@Module({
  providers: [
    {
      provide: TEMPORAL_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): Client =>
        new Client({
          connection: Connection.lazy({ address: config.getOrThrow('TEMPORAL_ADDRESS') }),
          namespace: config.getOrThrow('TEMPORAL_NAMESPACE'),
        }),
    },
    { provide: PAYMENT_ORCHESTRATOR, useClass: TemporalPaymentOrchestrator },
  ],
  exports: [TEMPORAL_CLIENT, PAYMENT_ORCHESTRATOR],
})
export class TemporalClientModule {}
