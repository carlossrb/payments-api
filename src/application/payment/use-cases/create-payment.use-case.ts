import { Payment, type PaymentSnapshot } from '@domain/payment/payment';
import type { PaymentMethod } from '@domain/payment/payment-method';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EVENT_OUTBOX, type EventOutbox } from '../../shared/ports/event-outbox';
import { UNIT_OF_WORK, type UnitOfWork } from '../../shared/ports/unit-of-work';
import { CHECKOUT_AWAIT_TIMEOUT_MS, PAYMENT_EVENTS } from '../payment.const';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../ports/payment.repository';
import type { CheckoutSession } from '../ports/payment-gateway';
import { PAYMENT_ORCHESTRATOR, type PaymentOrchestrator } from '../ports/payment-orchestrator';

export interface CreatePaymentInput {
  cpf: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

@Injectable()
export class CreatePaymentUseCase {
  private readonly logger = new Logger(CreatePaymentUseCase.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(EVENT_OUTBOX) private readonly outbox: EventOutbox,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(PAYMENT_ORCHESTRATOR) private readonly orchestrator: PaymentOrchestrator,
  ) {}

  async execute(input: CreatePaymentInput): Promise<PaymentSnapshot> {
    const payment = Payment.create(input);

    await this.unitOfWork.run(async (tx) => {
      await this.payments.save(payment, tx);

      if (!payment.requiresCheckout) return;

      await this.outbox.enqueue(
        { name: PAYMENT_EVENTS.CREDIT_CARD_PAYMENT_REQUESTED, payload: { paymentId: payment.id } },
        tx,
      );
    });

    if (!payment.requiresCheckout) return payment.toSnapshot();

    const checkout = await this.startCheckout(payment.id);

    if (checkout) payment.attachCheckout(checkout);

    return payment.toSnapshot();
  }

  private async startCheckout(paymentId: string): Promise<CheckoutSession | null> {
    try {
      await this.orchestrator.startCreditCardPayment(paymentId);

      return await this.orchestrator.awaitCheckout(paymentId, CHECKOUT_AWAIT_TIMEOUT_MS);
    } catch (error) {
      this.logger.warn(
        `Could not start the credit card workflow for payment ${paymentId} inline, the outbox will retry: ${(error as Error).message}`,
      );

      return null;
    }
  }
}
