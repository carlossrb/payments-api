import { describe, expect, it } from 'vitest';
import { OUTBOX } from './outbox.const';
import { resolveNextAttemptAt, resolveRetryDelayMs } from './outbox-backoff';

const { BASE_MS, FACTOR, MAX_MS, JITTER_RATIO } = OUTBOX.RETRY_BACKOFF;
const NO_JITTER = 0.5;

describe('resolveRetryDelayMs', () => {
  it('grows exponentially from the base delay', () => {
    expect(resolveRetryDelayMs(1, NO_JITTER)).toBe(BASE_MS);
    expect(resolveRetryDelayMs(2, NO_JITTER)).toBe(BASE_MS * FACTOR);
    expect(resolveRetryDelayMs(3, NO_JITTER)).toBe(BASE_MS * FACTOR ** 2);
  });

  it('never exceeds the ceiling', () => {
    expect(resolveRetryDelayMs(30, NO_JITTER)).toBe(MAX_MS);
  });

  it('spreads retries within the jitter band', () => {
    expect(resolveRetryDelayMs(1, 0)).toBe(BASE_MS * (1 - JITTER_RATIO));
    expect(resolveRetryDelayMs(1, 1)).toBe(BASE_MS * (1 + JITTER_RATIO));
  });
});

describe('resolveNextAttemptAt', () => {
  it('schedules ahead of the reference time', () => {
    const from = new Date('2026-09-21T00:00:00.000Z');

    expect(resolveNextAttemptAt(1, from).getTime()).toBeGreaterThan(from.getTime());
  });
});
