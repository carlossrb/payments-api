export const PAYMENT_EVENTS = {
  CREDIT_CARD_PAYMENT_REQUESTED: 'CREDIT_CARD_PAYMENT_REQUESTED',
  GATEWAY_NOTIFICATION_RECEIVED: 'GATEWAY_NOTIFICATION_RECEIVED',
} as const;

export const PAYMENT_CACHE = {
  TTL_SECONDS: 60,
  NOTIFICATION_DEDUPE_TTL_SECONDS: 86_400,
} as const;

export const PAYMENT_LOCK = {
  TTL_MS: 10_000,
  WAIT_MS: 3_000,
} as const;

export const CHECKOUT_AWAIT_TIMEOUT_MS = 8_000;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const paymentCacheKey = (paymentId: string): string => `payment:${paymentId}`;

export const paymentLockKey = (paymentId: string): string => `lock:payment:${paymentId}`;

export const notificationDedupeKey = (notificationId: string): string =>
  `gateway:notification:${notificationId}`;
