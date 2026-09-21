export const OUTBOX = {
  SCHEDULE: '*/2 * * * * *',
  BATCH_SIZE: 20,
  REAPER_BATCH_SIZE: 50,
  PROCESSING_TIMEOUT_MS: 5 * 60_000,
  MAX_ATTEMPTS: 8,
  LOCK: {
    PROCESS: { key: 'lock:outbox:process', ttlMs: 30_000 },
    REAPER: { key: 'lock:outbox:reaper', ttlMs: 60_000 },
  },
  RETRY_BACKOFF: {
    BASE_MS: 5_000,
    FACTOR: 3,
    MAX_MS: 10 * 60_000,
    JITTER_RATIO: 0.2,
  },
} as const;
