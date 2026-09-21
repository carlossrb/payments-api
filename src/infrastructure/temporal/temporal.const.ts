export const TEMPORAL = {
  CREDIT_CARD_WORKFLOW: 'creditCardPaymentWorkflow',
  WORKER_CONNECT_ATTEMPTS: 30,
  WORKER_CONNECT_DELAY_MS: 2_000,
} as const;

export const TEMPORAL_CLIENT = Symbol('TemporalClient');

export const creditCardWorkflowId = (paymentId: string): string =>
  `credit-card-payment-${paymentId}`;
