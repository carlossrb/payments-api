import { Payment } from '@domain/payment/payment';
import { PaymentNotFoundError } from '@domain/payment/payment.errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paymentCacheKey } from '../payment.const';
import { InMemoryCache, InMemoryPaymentRepository, pixInput } from '../testing/fakes';
import { GetPaymentUseCase } from './get-payment.use-case';

describe('GetPaymentUseCase', () => {
  let payments: InMemoryPaymentRepository;
  let cache: InMemoryCache;
  let useCase: GetPaymentUseCase;

  beforeEach(() => {
    payments = new InMemoryPaymentRepository();
    cache = new InMemoryCache();
    useCase = new GetPaymentUseCase(payments, cache);
  });

  it('reads from the repository and fills the cache on a miss', async () => {
    const payment = Payment.create(pixInput());
    await payments.save(payment);

    const result = await useCase.execute(payment.id);

    expect(result.id).toBe(payment.id);
    expect(cache.entries.get(paymentCacheKey(payment.id))).toEqual(result);
  });

  it('serves the cached snapshot without hitting the repository', async () => {
    const snapshot = Payment.create(pixInput()).toSnapshot();
    await cache.set(paymentCacheKey(snapshot.id), snapshot);
    const findById = vi.spyOn(payments, 'findById');

    const result = await useCase.execute(snapshot.id);

    expect(result).toEqual(snapshot);
    expect(findById).not.toHaveBeenCalled();
  });

  it('throws when the payment does not exist', async () => {
    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(PaymentNotFoundError);
  });
});
