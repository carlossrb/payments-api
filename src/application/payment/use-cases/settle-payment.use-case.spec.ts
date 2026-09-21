import { Payment } from '@domain/payment/payment';
import { PaymentNotFoundError } from '@domain/payment/payment.errors';
import { PaymentStatus } from '@domain/payment/payment-status';
import { beforeEach, describe, expect, it } from 'vitest';
import { paymentCacheKey, paymentLockKey } from '../payment.const';
import {
  creditCardInput,
  InMemoryCache,
  InMemoryPaymentRepository,
  PassthroughLock,
} from '../testing/fakes';
import { SettlePaymentUseCase } from './settle-payment.use-case';

describe('SettlePaymentUseCase', () => {
  let payments: InMemoryPaymentRepository;
  let cache: InMemoryCache;
  let lock: PassthroughLock;
  let useCase: SettlePaymentUseCase;

  beforeEach(() => {
    payments = new InMemoryPaymentRepository();
    cache = new InMemoryCache();
    lock = new PassthroughLock();
    useCase = new SettlePaymentUseCase(payments, cache, lock);
  });

  it('marks the payment as PAID with the gateway id', async () => {
    const payment = Payment.create(creditCardInput());
    await payments.save(payment);
    await cache.set(paymentCacheKey(payment.id), payment.toSnapshot());

    const result = await useCase.execute({
      paymentId: payment.id,
      outcome: { status: PaymentStatus.PAID, gatewayPaymentId: 'mp-1', reason: null },
    });

    expect(result.status).toBe(PaymentStatus.PAID);
    expect(result.gatewayPaymentId).toBe('mp-1');
    expect(lock.acquired).toEqual([paymentLockKey(payment.id)]);
    expect(cache.entries.has(paymentCacheKey(payment.id))).toBe(false);
  });

  it('marks the payment as FAIL with the reason', async () => {
    const payment = Payment.create(creditCardInput());
    await payments.save(payment);

    const result = await useCase.execute({
      paymentId: payment.id,
      outcome: { status: PaymentStatus.FAIL, gatewayPaymentId: 'mp-2', reason: 'cc_rejected' },
    });

    expect(result.status).toBe(PaymentStatus.FAIL);
    expect(result.failureReason).toBe('cc_rejected');
  });

  it('ignores outcomes for payments that are already final', async () => {
    const payment = Payment.create(creditCardInput());
    payment.markAsFailed({ reason: 'MANUAL_UPDATE' });
    await payments.save(payment);

    const result = await useCase.execute({
      paymentId: payment.id,
      outcome: { status: PaymentStatus.PAID, gatewayPaymentId: 'mp-1', reason: null },
    });

    expect(result.status).toBe(PaymentStatus.FAIL);
    expect(payments.saved).toHaveLength(1);
  });

  it('throws when the payment does not exist', async () => {
    await expect(
      useCase.execute({
        paymentId: 'missing',
        outcome: { status: PaymentStatus.PAID, gatewayPaymentId: null, reason: null },
      }),
    ).rejects.toBeInstanceOf(PaymentNotFoundError);
  });
});
