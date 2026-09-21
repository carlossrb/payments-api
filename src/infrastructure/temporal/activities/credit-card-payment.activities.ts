import type { PaymentOutcome } from '@application/payment/gateway-outcome';
import {
  type CheckoutSession,
  type GatewayPayment,
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '@application/payment/ports/payment-gateway';
import { CreateCheckoutUseCase } from '@application/payment/use-cases/create-checkout.use-case';
import { SettlePaymentUseCase } from '@application/payment/use-cases/settle-payment.use-case';
import { LockUnavailableError } from '@application/shared/errors';
import { DomainError, DomainErrorKind } from '@domain/shared/domain-error';
import { Inject, Injectable } from '@nestjs/common';
import { ApplicationFailure } from '@temporalio/activity';

const isRetryable = (error: DomainError): boolean =>
  error.kind === DomainErrorKind.DEPENDENCY || error instanceof LockUnavailableError;

const toActivityFailure = (error: unknown): unknown => {
  if (!(error instanceof DomainError)) return error;

  return ApplicationFailure.create({
    type: error.name,
    message: error.message,
    nonRetryable: !isRetryable(error),
    details: [error.code, error.details ?? null],
    cause: error,
  });
};

const run = async <T>(task: () => Promise<T>): Promise<T> => {
  try {
    return await task();
  } catch (error) {
    throw toActivityFailure(error);
  }
};

@Injectable()
export class CreditCardPaymentActivities {
  constructor(
    private readonly createCheckoutUseCase: CreateCheckoutUseCase,
    private readonly settlePaymentUseCase: SettlePaymentUseCase,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  createCheckout(input: { paymentId: string }): Promise<CheckoutSession> {
    return run(() => this.createCheckoutUseCase.execute(input.paymentId));
  }

  findGatewayPayment(input: { paymentId: string }): Promise<GatewayPayment | null> {
    return run(() => this.gateway.findPaymentByReference(input.paymentId));
  }

  async settlePayment(input: { paymentId: string; outcome: PaymentOutcome }): Promise<void> {
    await run(() => this.settlePaymentUseCase.execute(input));
  }
}

export const bindActivities = (activities: CreditCardPaymentActivities) => ({
  createCheckout: activities.createCheckout.bind(activities),
  findGatewayPayment: activities.findGatewayPayment.bind(activities),
  settlePayment: activities.settlePayment.bind(activities),
});
