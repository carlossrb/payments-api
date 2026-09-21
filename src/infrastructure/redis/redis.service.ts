import type { EnvironmentVariables } from '@infrastructure/config/env';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient>;

const MAX_RECONNECT_DELAY_MS = 3_000;

const buildRedisUrl = (config: ConfigService<EnvironmentVariables, true>): string => {
  const host = config.get('REDIS_HOST', { infer: true });
  const port = config.get('REDIS_PORT', { infer: true });
  const password = config.get('REDIS_PASSWORD', { infer: true });
  const auth = password ? `:${encodeURIComponent(password)}@` : '';

  return `redis://${auth}${host}:${port}`;
};

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: RedisClient;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.client = createClient({
      url: buildRedisUrl(config),
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 200, MAX_RECONNECT_DELAY_MS),
      },
    });
    this.client.on('error', (error: Error) => this.logger.warn(`Redis error: ${error.message}`));
    this.client.on('ready', () => this.logger.log('Redis connection ready'));
  }

  get isReady(): boolean {
    return this.client.isReady;
  }

  onModuleInit(): void {
    this.client.connect().catch((error: Error) => {
      this.logger.warn(`Redis unavailable at boot, running without it: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client.isOpen) return;

    await this.client.quit().catch(() => undefined);
  }
}
