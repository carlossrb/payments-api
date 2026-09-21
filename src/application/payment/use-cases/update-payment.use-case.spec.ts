import { Payment } from '@domain/payment/payment';
import { PaymentNotFoundError, StatusManagedByGatewayError } from '@domain/payment/payment.errors';
import { PaymentStatus } from '@domain/payment/payment-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paymentCacheKey, paymentLockKey } from '../payment.const';
import {
  buildOrchestratorStub,
  creditCardInput,
  InMemoryCache,
  InMemoryPaymentRepository,
  PassthroughLock,
  pixInput,
} from '../testing/fakes';
import { UpdatePaymentUseCase } from './update-payment.use-case';

const representation = (payment: Payment) => ({
  paymentId: payment.id,
  cpf: payment.cpf.value,
  description: payment.description,
  amount: payment.amount.toDecimal(),
  paymentMethod: payment.paymentMethod,
  status: payment.status,
});

describe('UpdatePaymentUseCase', () => {
  let payments: InMemoryPaymentRepository;
  let cache: InMemoryCache;
  let lock: PassthroughLock;
  let orchestrator: ReturnType<typeof buildOrchestratorStub>;
  let useCase: UpdatePaymentUseCase;

  beforeEach(() => {
    payments = new InMemoryPaymentRepository();
    cache = new InMemoryCache();
    lock = new PassthroughLock();
    orchestrator = buildOrchestratorStub();
    useCase = new UpdatePaymentUseCase(payments, cache, lock, orchestrator);
  });

  it('updates the payment under a per-payment lock and evicts the cache', async () => {
    const payment = Payment.create(pixInput());
    await payments.save(payment);
    await cache.set(paymentCacheKey(payment.id), payment.toSnapshot());

    const result = await useCase.execute({ ...representation(payment), description: 'Updated' });

    expect(result.description).toBe('Updated');
    expect(lock.acquired).toEqual([paymentLockKey(payment.id)]);
    expect(cache.entries.has(paymentCacheKey(payment.id))).toBe(false);
  });

  it('confirms a PIX payment manually', async () => {
    const payment = Payment.create(pixInput());
    await payments.save(payment);

    const result = await useCase.execute({
      ...representation(payment),
      status: PaymentStatus.PAID,
    });

    expect(result.status).toBe(PaymentStatus.PAID);
    expect(orchestrator.cancel).not.toHaveBeenCalled();
  });

  it('cancels the workflow when a credit card payment is failed manually', async () => {
    const payment = Payment.create(creditCardInput());
    await payments.save(payment);

    const result = await useCase.execute({
      ...representation(payment),
      status: PaymentStatus.FAIL,
    });

    expect(result.status).toBe(PaymentStatus.FAIL);
    expect(orchestrator.cancel).toHaveBeenCalledWith(payment.id);
  });

  it('keeps the update even when the workflow cancellation fails', async () => {
    vi.mocked(orchestrator.cancel).mockRejectedValue(new Error('temporal down'));
    const payment = Payment.create(creditCardInput());
    await payments.save(payment);

    const result = await useCase.execute({
      ...representation(payment),
      status: PaymentStatus.FAIL,
    });

    expect(result.status).toBe(PaymentStatus.FAIL);
  });

  it('propagates domain rules', async () => {
    const payment = Payment.create(creditCardInput());
    await payments.save(payment);

    await expect(
      useCase.execute({ ...representation(payment), status: PaymentStatus.PAID }),
    ).rejects.toBeInstanceOf(StatusManagedByGatewayError);
  });

  it('throws when the payment does not exist', async () => {
    const payment = Payment.create(pixInput());

    await expect(useCase.execute(representation(payment))).rejects.toBeInstanceOf(
      PaymentNotFoundError,
    );
  });
});
