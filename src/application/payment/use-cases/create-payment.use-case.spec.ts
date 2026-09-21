import { PaymentStatus } from '@domain/payment/payment-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PAYMENT_EVENTS } from '../payment.const';
import {
  buildOrchestratorStub,
  creditCardInput,
  ImmediateUnitOfWork,
  InMemoryPaymentRepository,
  pixInput,
  RecordingOutbox,
} from '../testing/fakes';
import { CreatePaymentUseCase } from './create-payment.use-case';

describe('CreatePaymentUseCase', () => {
  let payments: InMemoryPaymentRepository;
  let outbox: RecordingOutbox;
  let orchestrator: ReturnType<typeof buildOrchestratorStub>;
  let useCase: CreatePaymentUseCase;

  beforeEach(() => {
    payments = new InMemoryPaymentRepository();
    outbox = new RecordingOutbox();
    orchestrator = buildOrchestratorStub();
    useCase = new CreatePaymentUseCase(payments, outbox, new ImmediateUnitOfWork(), orchestrator);
  });

  it('stores a PIX payment as PENDING without touching the gateway', async () => {
    const result = await useCase.execute(pixInput());

    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.checkout).toBeNull();
    expect(payments.payments.size).toBe(1);
    expect(outbox.events).toHaveLength(0);
    expect(orchestrator.startCreditCardPayment).not.toHaveBeenCalled();
  });

  it('records the outbox event and starts the workflow for credit card payments', async () => {
    vi.mocked(orchestrator.awaitCheckout).mockResolvedValue({
      preferenceId: 'pref-1',
      url: 'https://mp/checkout/pref-1',
    });

    const result = await useCase.execute(creditCardInput());

    expect(outbox.events).toEqual([
      { name: PAYMENT_EVENTS.CREDIT_CARD_PAYMENT_REQUESTED, payload: { paymentId: result.id } },
    ]);
    expect(orchestrator.startCreditCardPayment).toHaveBeenCalledWith(result.id);
    expect(result.checkout?.url).toBe('https://mp/checkout/pref-1');
  });

  it('still returns the pending payment when the workflow cannot be started inline', async () => {
    vi.mocked(orchestrator.startCreditCardPayment).mockRejectedValue(new Error('temporal down'));

    const result = await useCase.execute(creditCardInput());

    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.checkout).toBeNull();
    expect(outbox.events).toHaveLength(1);
  });

  it('returns without a checkout when the gateway takes too long', async () => {
    const result = await useCase.execute(creditCardInput());

    expect(orchestrator.awaitCheckout).toHaveBeenCalledWith(result.id, expect.any(Number));
    expect(result.checkout).toBeNull();
  });
});
