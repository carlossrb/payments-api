import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { LockUnavailableError } from '@application/shared/errors';
import type { DistributedLock, LockOptions } from '@application/shared/ports/distributed-lock';
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

const RELEASE_IF_OWNER = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

const RENEW_IF_OWNER = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0
`;

const DEFAULT_TTL_MS = 10_000;
const RETRY_INTERVAL_MS = 100;
const MIN_RENEWAL_INTERVAL_MS = 1_000;
const RENEWALS_PER_TTL = 3;

@Injectable()
export class RedisLock implements DistributedLock {
  private readonly logger = new Logger(RedisLock.name);

  constructor(private readonly redis: RedisService) {}

  async withLock<T>(key: string, task: () => Promise<T>, options: LockOptions = {}): Promise<T> {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const token = randomUUID();
    const acquired = await this.acquireWithin(key, token, ttlMs, options.waitMs ?? 0);

    if (!acquired) throw new LockUnavailableError(key);

    const renewal = this.startRenewal(key, token, ttlMs);

    try {
      return await task();
    } finally {
      clearInterval(renewal);
      await this.release(key, token);
    }
  }

  private async acquireWithin(key: string, token: string, ttlMs: number, waitMs: number) {
    const deadline = Date.now() + waitMs;

    while (true) {
      if (await this.acquire(key, token, ttlMs)) return true;
      if (Date.now() >= deadline) return false;

      await sleep(RETRY_INTERVAL_MS);
    }
  }

  private async acquire(key: string, token: string, ttlMs: number): Promise<boolean> {
    if (!this.redis.isReady) {
      this.logger.warn(`Redis unavailable, running "${key}" without a lock`);

      return true;
    }

    try {
      const result = await this.redis.client.set(key, token, {
        condition: 'NX',
        expiration: { type: 'PX', value: ttlMs },
      });

      return result === 'OK';
    } catch (error) {
      this.logger.warn(
        `Failed to acquire lock "${key}", running without it: ${(error as Error).message}`,
      );

      return true;
    }
  }

  private startRenewal(key: string, token: string, ttlMs: number): NodeJS.Timeout {
    const every = Math.max(Math.floor(ttlMs / RENEWALS_PER_TTL), MIN_RENEWAL_INTERVAL_MS);
    const renewal = setInterval(() => void this.renew(key, token, ttlMs), every);

    renewal.unref();

    return renewal;
  }

  private async renew(key: string, token: string, ttlMs: number): Promise<void> {
    if (!this.redis.isReady) return;

    await this.redis.client
      .eval(RENEW_IF_OWNER, { keys: [key], arguments: [token, String(ttlMs)] })
      .catch((error: Error) => this.logger.warn(`Failed to renew lock "${key}": ${error.message}`));
  }

  private async release(key: string, token: string): Promise<void> {
    if (!this.redis.isReady) return;

    await this.redis.client
      .eval(RELEASE_IF_OWNER, { keys: [key], arguments: [token] })
      .catch((error: Error) =>
        this.logger.warn(`Failed to release lock "${key}": ${error.message}`),
      );
  }
}
