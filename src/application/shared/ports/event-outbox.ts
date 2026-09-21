import type { TransactionContext } from './unit-of-work';

export const EVENT_OUTBOX = Symbol('EventOutbox');

export interface OutboxEventInput {
  name: string;
  payload: Record<string, unknown>;
}

export interface EventOutbox {
  enqueue(event: OutboxEventInput, tx?: TransactionContext): Promise<void>;
}
