import { OUTBOX } from './outbox.const';

const { BASE_MS, FACTOR, MAX_MS, JITTER_RATIO } = OUTBOX.RETRY_BACKOFF;

export const resolveRetryDelayMs = (attempt: number, random = Math.random()): number => {
  const exponential = BASE_MS * FACTOR ** Math.max(attempt - 1, 0);
  const capped = Math.min(exponential, MAX_MS);
  const jitter = capped * JITTER_RATIO * (random * 2 - 1);

  return Math.max(Math.round(capped + jitter), 0);
};

export const resolveNextAttemptAt = (attempt: number, from = new Date()): Date =>
  new Date(from.getTime() + resolveRetryDelayMs(attempt));
