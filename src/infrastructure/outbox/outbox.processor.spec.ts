import { LockUnavailableError } from '@application/shared/errors';
import type { DistributedLock } from '@application/shared/ports/distributed-lock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OUTBOX } from './outbox.const';
import { OutboxProcessor } from './outbox.processor';
import type { OutboxHandler } from './outbox-handler';
import type { OutboxEventRecord, OutboxStore } from './outbox-store';

const event = (overrides: Partial<OutboxEventRecord> = {}): OutboxEventRecord => ({
  id: 'evt-1',
  eventName: 'PAYMENT_EVENT',
  payload: { paymentId: 'p-1' },
  attempts: 0,
  createdAt: new Date(),
  ...overrides,
});

const buildStore = (pending: OutboxEventRecord[] = [], stuck: OutboxEventRecord[] = []) =>
  ({
    findPending: vi.fn(async () => pending),
    claim: vi.fn(async () => true),
    markProcessed: vi.fn(async () => undefined),
    scheduleRetry: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
    findStuck: vi.fn(async () => stuck),
  }) satisfies OutboxStore;

const passthroughLock: DistributedLock = { withLock: (_key, task) => task() };

const buildHandler = (
  handle: OutboxHandler['handle'] = vi.fn(async () => undefined),
): OutboxHandler => ({
  name: 'test-handler',
  eventNames: ['PAYMENT_EVENT'],
  maxAttempts: 3,
  handle,
});

describe('OutboxProcessor', () => {
  let store: ReturnType<typeof buildStore>;

  beforeEach(() => {
    store = buildStore([event()]);
  });

  it('claims, handles and marks events as processed', async () => {
    const handler = buildHandler();
    const processor = new OutboxProcessor(store, passthroughLock, [handler]);

    await processor.processPending();

    expect(store.findPending).toHaveBeenCalledWith(['PAYMENT_EVENT'], OUTBOX.BATCH_SIZE);
    expect(store.claim).toHaveBeenCalledWith('evt-1');
    expect(handler.handle).toHaveBeenCalledWith(expect.objectContaining({ id: 'evt-1' }));
    expect(store.markProcessed).toHaveBeenCalledWith('evt-1');
  });

  it('skips events another instance claimed first', async () => {
    store.claim.mockResolvedValue(false);
    const handler = buildHandler();

    await new OutboxProcessor(store, passthroughLock, [handler]).processPending();

    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('schedules a retry with backoff when the handler fails', async () => {
    const handler = buildHandler(vi.fn(async () => Promise.reject(new Error('boom'))));

    await new OutboxProcessor(store, passthroughLock, [handler]).processPending();

    expect(store.scheduleRetry).toHaveBeenCalledWith('evt-1', 1, expect.any(Date), 'boom');
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it('gives up after the handler max attempts', async () => {
    store = buildStore([event({ attempts: 2 })]);
    const handler = buildHandler(vi.fn(async () => Promise.reject(new Error('boom'))));

    await new OutboxProcessor(store, passthroughLock, [handler]).processPending();

    expect(store.markFailed).toHaveBeenCalledWith('evt-1', 3, 'boom');
  });

  it('does nothing when another instance holds the lock', async () => {
    const lock: DistributedLock = {
      withLock: async (key) => {
        throw new LockUnavailableError(key);
      },
    };

    await new OutboxProcessor(store, lock, [buildHandler()]).processPending();

    expect(store.findPending).not.toHaveBeenCalled();
  });

  it('releases stuck events back to the queue', async () => {
    store = buildStore([], [event({ attempts: 0 })]);

    await new OutboxProcessor(store, passthroughLock, [buildHandler()]).reapStuck();

    expect(store.findStuck).toHaveBeenCalledWith(expect.any(Date), OUTBOX.REAPER_BATCH_SIZE);
    expect(store.scheduleRetry).toHaveBeenCalledWith(
      'evt-1',
      1,
      expect.any(Date),
      'stuck in PROCESSING past the timeout',
    );
  });
});
