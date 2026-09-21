import { LockUnavailableError } from '@application/shared/errors';
import { DISTRIBUTED_LOCK, type DistributedLock } from '@application/shared/ports/distributed-lock';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OUTBOX } from './outbox.const';
import { resolveNextAttemptAt } from './outbox-backoff';
import { OUTBOX_HANDLERS, type OutboxHandler } from './outbox-handler';
import { OUTBOX_STORE, type OutboxEventRecord, type OutboxStore } from './outbox-store';

const describe = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  return String(error);
};

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    @Inject(OUTBOX_STORE) private readonly store: OutboxStore,
    @Inject(DISTRIBUTED_LOCK) private readonly lock: DistributedLock,
    @Inject(OUTBOX_HANDLERS) private readonly handlers: OutboxHandler[],
  ) {}

  @Cron(OUTBOX.SCHEDULE, { waitForCompletion: true })
  async processPending(): Promise<void> {
    await this.runExclusive(OUTBOX.LOCK.PROCESS, () => this.processAll());
  }

  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async reapStuck(): Promise<void> {
    await this.runExclusive(OUTBOX.LOCK.REAPER, () => this.releaseStuckEvents());
  }

  async processAll(): Promise<void> {
    for (const handler of this.handlers) await this.processHandler(handler);
  }

  async processHandler(handler: OutboxHandler): Promise<void> {
    const events = await this.store.findPending(handler.eventNames, OUTBOX.BATCH_SIZE);

    for (const event of events) {
      const claimed = await this.store.claim(event.id);

      if (!claimed) continue;

      await this.handleClaimed(handler, event);
    }
  }

  async releaseStuckEvents(): Promise<void> {
    const olderThan = new Date(Date.now() - OUTBOX.PROCESSING_TIMEOUT_MS);
    const events = await this.store.findStuck(olderThan, OUTBOX.REAPER_BATCH_SIZE);

    for (const event of events) {
      await this.retryOrFail(event, OUTBOX.MAX_ATTEMPTS, 'stuck in PROCESSING past the timeout');
    }
  }

  private async handleClaimed(handler: OutboxHandler, event: OutboxEventRecord): Promise<void> {
    try {
      await handler.handle(event);
      await this.store.markProcessed(event.id);
      this.logger.log(`Outbox event ${event.id} (${event.eventName}) processed by ${handler.name}`);
    } catch (error) {
      await this.retryOrFail(event, handler.maxAttempts, describe(error));
    }
  }

  private async retryOrFail(event: OutboxEventRecord, maxAttempts: number, reason: string) {
    const attempts = event.attempts + 1;

    if (attempts >= maxAttempts) {
      await this.store.markFailed(event.id, attempts, reason);
      this.logger.error(
        `Outbox event ${event.id} (${event.eventName}) gave up after ${attempts} attempts: ${reason}`,
      );

      return;
    }

    const nextAttemptAt = resolveNextAttemptAt(attempts);

    await this.store.scheduleRetry(event.id, attempts, nextAttemptAt, reason);
    this.logger.warn(
      `Outbox event ${event.id} (${event.eventName}) failed (attempt ${attempts}/${maxAttempts}), retrying at ${nextAttemptAt.toISOString()}: ${reason}`,
    );
  }

  private async runExclusive(
    lock: { key: string; ttlMs: number },
    task: () => Promise<void>,
  ): Promise<void> {
    try {
      await this.lock.withLock(lock.key, task, { ttlMs: lock.ttlMs, waitMs: 0 });
    } catch (error) {
      if (error instanceof LockUnavailableError) return;

      this.logger.error(`Outbox run failed: ${describe(error)}`);
    }
  }
}
