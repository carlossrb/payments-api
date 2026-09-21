import { type PaymentOutcome, resolvePaymentOutcome } from '@application/payment/gateway-outcome';
import type { CheckoutSession } from '@application/payment/ports/payment-gateway';
import { PaymentStatus } from '@domain/payment/payment-status';
import { condition, log, proxyActivities, setHandler } from '@temporalio/workflow';
import type { CreditCardPaymentActivities } from '../activities/credit-card-payment.activities';
import {
  awaitCheckoutUpdate,
  CHECKOUT_FAILURE_REASONS,
  type CreditCardPaymentInput,
  type CreditCardPaymentResult,
  cancelSignal,
  checkoutQuery,
  gatewayPaymentSignal,
} from './credit-card-payment.definitions';

const MINUTE_MS = 60_000;
const SECOND_MS = 1_000;

const { createCheckout } = proxyActivities<CreditCardPaymentActivities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '2 seconds',
    backoffCoefficient: 2,
    maximumInterval: '1 minute',
    maximumAttempts: 20,
  },
});

const { findGatewayPayment } = proxyActivities<CreditCardPaymentActivities>({
  startToCloseTimeout: '30 seconds',
  retry: { initialInterval: '2 seconds', backoffCoefficient: 2, maximumAttempts: 3 },
});

const { settlePayment } = proxyActivities<CreditCardPaymentActivities>({
  startToCloseTimeout: '30 seconds',
  retry: { initialInterval: '1 second', backoffCoefficient: 2, maximumInterval: '1 minute' },
});

export async function creditCardPaymentWorkflow(
  input: CreditCardPaymentInput,
): Promise<CreditCardPaymentResult> {
  const { paymentId } = input;
  let checkout: CheckoutSession | null = null;
  let outcome: PaymentOutcome | null = null;
  let cancelled = false;

  const settled = () => outcome !== null || cancelled;
  const acceptOutcome = (candidate: PaymentOutcome | null) => {
    if (candidate && !outcome) outcome = candidate;
  };

  setHandler(checkoutQuery, () => checkout);
  setHandler(awaitCheckoutUpdate, async () => {
    await condition(() => checkout !== null || settled());

    return checkout;
  });
  setHandler(gatewayPaymentSignal, (gatewayPayment) =>
    acceptOutcome(resolvePaymentOutcome(gatewayPayment)),
  );
  setHandler(cancelSignal, () => {
    cancelled = true;
  });

  try {
    checkout = await createCheckout({ paymentId });
  } catch (error) {
    log.error(`Checkout creation failed for payment ${paymentId}`, { error });
    acceptOutcome({
      status: PaymentStatus.FAIL,
      gatewayPaymentId: null,
      reason: CHECKOUT_FAILURE_REASONS.CREATION_FAILED,
    });
  }

  const expiresAt = Date.now() + input.checkoutTtlMinutes * MINUTE_MS;
  const pollIntervalMs = input.pollIntervalSeconds * SECOND_MS;

  while (!settled()) {
    const remainingMs = expiresAt - Date.now();

    if (remainingMs <= 0) {
      acceptOutcome({
        status: PaymentStatus.FAIL,
        gatewayPaymentId: null,
        reason: CHECKOUT_FAILURE_REASONS.EXPIRED,
      });
      break;
    }

    const woken = await condition(settled, Math.min(pollIntervalMs, remainingMs));

    if (woken) break;

    await pollGateway(paymentId, acceptOutcome);
  }

  if (!outcome) {
    log.info(`Payment ${paymentId} workflow cancelled before an outcome was reached`);

    return { status: 'CANCELLED' };
  }

  await settlePayment({ paymentId, outcome });

  return { status: 'SETTLED', outcome };
}

async function pollGateway(paymentId: string, accept: (outcome: PaymentOutcome | null) => void) {
  try {
    const gatewayPayment = await findGatewayPayment({ paymentId });

    if (gatewayPayment) accept(resolvePaymentOutcome(gatewayPayment));
  } catch (error) {
    log.warn(`Polling the gateway for payment ${paymentId} failed, will retry on the next cycle`, {
      error,
    });
  }
}
