export const UNIT_OF_WORK = Symbol('UnitOfWork');

export type TransactionContext = unknown;

export interface UnitOfWork {
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
