export const OUTBOX_STORE = Symbol('OutboxStore');

export interface OutboxEventRecord {
  id: string;
  eventName: string;
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: Date;
}

export interface OutboxStore {
  findPending(eventNames: readonly string[], batchSize: number): Promise<OutboxEventRecord[]>;
  claim(id: string): Promise<boolean>;
  markProcessed(id: string): Promise<void>;
  scheduleRetry(id: string, attempts: number, nextAttemptAt: Date, error: string): Promise<void>;
  markFailed(id: string, attempts: number, error: string): Promise<void>;
  findStuck(olderThan: Date, batchSize: number): Promise<OutboxEventRecord[]>;
}
