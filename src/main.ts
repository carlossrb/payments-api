import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { type AppConfig, NodeEnv } from './infrastructure/config/env';
import { setupDocs } from './presentation/http/docs/setup-docs';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService) as AppConfig;
  const port = config.getOrThrow('APP_PORT');

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  if (config.getOrThrow('NODE_ENV') !== NodeEnv.PRODUCTION) setupDocs(app);

  await app.listen(port);

  new Logger('Bootstrap').log(`Payments API listening on port ${port}`);
}

bootstrap();
