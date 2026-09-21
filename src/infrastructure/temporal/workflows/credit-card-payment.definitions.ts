import type { PaymentOutcome } from '@application/payment/gateway-outcome';
import type { CheckoutSession, GatewayPayment } from '@application/payment/ports/payment-gateway';
import { defineQuery, defineSignal, defineUpdate } from '@temporalio/workflow';

export interface CreditCardPaymentInput {
  paymentId: string;
  checkoutTtlMinutes: number;
  pollIntervalSeconds: number;
}

export type CreditCardPaymentResult =
  | { status: 'SETTLED'; outcome: PaymentOutcome }
  | { status: 'CANCELLED' };

export const CHECKOUT_FAILURE_REASONS = {
  CREATION_FAILED: 'CHECKOUT_CREATION_FAILED',
  EXPIRED: 'CHECKOUT_EXPIRED',
} as const;

export const gatewayPaymentSignal = defineSignal<[GatewayPayment]>('gatewayPayment');
export const cancelSignal = defineSignal('cancel');
export const checkoutQuery = defineQuery<CheckoutSession | null>('checkout');
export const awaitCheckoutUpdate = defineUpdate<CheckoutSession | null>('awaitCheckout');
