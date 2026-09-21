import type { OutboxEventRecord } from './outbox-store';

export const OUTBOX_HANDLERS = Symbol('OutboxHandlers');

export interface OutboxHandler {
  readonly name: string;
  readonly eventNames: readonly string[];
  readonly maxAttempts: number;
  handle(event: OutboxEventRecord): Promise<void>;
}
