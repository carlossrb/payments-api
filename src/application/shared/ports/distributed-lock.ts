export const DISTRIBUTED_LOCK = Symbol('DistributedLock');

export interface LockOptions {
  ttlMs?: number;
  waitMs?: number;
}

export interface DistributedLock {
  withLock<T>(key: string, task: () => Promise<T>, options?: LockOptions): Promise<T>;
}
