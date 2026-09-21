import type { Cache } from '@application/shared/ports/cache';
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RedisCache implements Cache {
  private readonly logger = new Logger(RedisCache.name);

  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis.isReady) return null;

    try {
      const raw = await this.redis.client.get(key);

      if (!raw) return null;

      return JSON.parse(raw) as T;
    } catch (error) {
      this.warn('get', key, error);

      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.redis.isReady) return;

    try {
      await this.redis.client.set(key, JSON.stringify(value), {
        expiration: { type: 'EX', value: ttlSeconds },
      });
    } catch (error) {
      this.warn('set', key, error);
    }
  }

  async setIfAbsent<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    if (!this.redis.isReady) return true;

    try {
      const result = await this.redis.client.set(key, JSON.stringify(value), {
        condition: 'NX',
        expiration: { type: 'EX', value: ttlSeconds },
      });

      return result === 'OK';
    } catch (error) {
      this.warn('setIfAbsent', key, error);

      return true;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis.isReady) return;

    try {
      await this.redis.client.del(key);
    } catch (error) {
      this.warn('del', key, error);
    }
  }

  private warn(operation: string, key: string, error: unknown): void {
    this.logger.warn(`Cache ${operation} failed for "${key}": ${(error as Error).message}`);
  }
}
