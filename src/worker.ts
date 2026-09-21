import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { AppConfig } from './infrastructure/config/env';
import {
  bindActivities,
  CreditCardPaymentActivities,
} from './infrastructure/temporal/activities/credit-card-payment.activities';
import { createTemporalWorker } from './infrastructure/temporal/worker/temporal-worker';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const config = app.get(ConfigService) as AppConfig;
  const worker = await createTemporalWorker({
    address: config.getOrThrow('TEMPORAL_ADDRESS'),
    namespace: config.getOrThrow('TEMPORAL_NAMESPACE'),
    taskQueue: config.getOrThrow('TEMPORAL_TASK_QUEUE'),
    activities: bindActivities(app.get(CreditCardPaymentActivities)),
  });

  const shutdown = (signal: string) => {
    logger.log(`Received ${signal}, shutting the worker down`);
    worker.shutdown();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  logger.log(`Temporal worker polling task queue ${config.getOrThrow('TEMPORAL_TASK_QUEUE')}`);

  await worker.run();
  await app.close();
}

bootstrap();
