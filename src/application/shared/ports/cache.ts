export const CACHE = Symbol('Cache');

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  setIfAbsent<T>(key: string, value: T, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
}
