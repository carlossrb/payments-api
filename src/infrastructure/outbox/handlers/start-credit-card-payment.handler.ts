import { PAYMENT_EVENTS } from '@application/payment/payment.const';
import {
  PAYMENT_ORCHESTRATOR,
  type PaymentOrchestrator,
} from '@application/payment/ports/payment-orchestrator';
import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX } from '../outbox.const';
import type { OutboxHandler } from '../outbox-handler';
import type { OutboxEventRecord } from '../outbox-store';

@Injectable()
export class StartCreditCardPaymentHandler implements OutboxHandler {
  readonly name = 'start-credit-card-payment';
  readonly eventNames = [PAYMENT_EVENTS.CREDIT_CARD_PAYMENT_REQUESTED];
  readonly maxAttempts = OUTBOX.MAX_ATTEMPTS;

  constructor(@Inject(PAYMENT_ORCHESTRATOR) private readonly orchestrator: PaymentOrchestrator) {}

  async handle(event: OutboxEventRecord): Promise<void> {
    const paymentId = event.payload.paymentId;

    if (typeof paymentId !== 'string') throw new Error('Outbox payload without paymentId');

    await this.orchestrator.startCreditCardPayment(paymentId);
  }
}
