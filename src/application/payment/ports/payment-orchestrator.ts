import type { CheckoutSession, GatewayPayment } from './payment-gateway';

export const PAYMENT_ORCHESTRATOR = Symbol('PaymentOrchestrator');

export interface PaymentOrchestrator {
  startCreditCardPayment(paymentId: string): Promise<void>;
  awaitCheckout(paymentId: string, timeoutMs: number): Promise<CheckoutSession | null>;
  notifyGatewayPayment(paymentId: string, gatewayPayment: GatewayPayment): Promise<boolean>;
  cancel(paymentId: string): Promise<void>;
}
