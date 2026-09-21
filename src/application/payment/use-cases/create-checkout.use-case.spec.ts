import { Payment } from '@domain/payment/payment';
import { CheckoutNotAllowedError, PaymentNotFoundError } from '@domain/payment/payment.errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paymentCacheKey } from '../payment.const';
import {
  buildGatewayStub,
  creditCardInput,
  InMemoryCache,
  InMemoryPaymentRepository,
} from '../testing/fakes';
import { CreateCheckoutUseCase } from './create-checkout.use-case';

describe('CreateCheckoutUseCase', () => {
  let payments: InMemoryPaymentRepository;
  let gateway: ReturnType<typeof buildGatewayStub>;
  let cache: InMemoryCache;
  let useCase: CreateCheckoutUseCase;

  beforeEach(() => {
    payments = new InMemoryPaymentRepository();
    gateway = buildGatewayStub();
    cache = new InMemoryCache();
    useCase = new CreateCheckoutUseCase(payments, gateway, cache);
  });

  it('creates the gateway checkout with the payment data and persists it', async () => {
    const payment = Payment.create(creditCardInput());
    await payments.save(payment);
    await cache.set(paymentCacheKey(payment.id), payment.toSnapshot());

    const checkout = await useCase.execute(payment.id);

    expect(gateway.createCheckout).toHaveBeenCalledWith({
      paymentId: payment.id,
      description: 'Card charge',
      amount: 250.5,
      cpf: '52998224725',
    });
    expect(checkout).toEqual({ preferenceId: 'pref-1', url: 'https://mp/checkout/pref-1' });
    expect(payments.payments.get(payment.id)?.checkout).toEqual(checkout);
    expect(cache.entries.has(paymentCacheKey(payment.id))).toBe(false);
  });

  it('is idempotent when the payment already has a checkout', async () => {
    const payment = Payment.create(creditCardInput());
    payment.attachCheckout({ preferenceId: 'existing', url: 'https://mp/existing' });
    await payments.save(payment);

    const checkout = await useCase.execute(payment.id);

    expect(checkout.preferenceId).toBe('existing');
    expect(gateway.createCheckout).not.toHaveBeenCalled();
  });

  it('refuses to create a checkout for a payment that is no longer pending', async () => {
    const payment = Payment.create(creditCardInput());
    payment.markAsFailed({ reason: 'MANUAL_UPDATE' });
    await payments.save(payment);

    await expect(useCase.execute(payment.id)).rejects.toBeInstanceOf(CheckoutNotAllowedError);
    expect(gateway.createCheckout).not.toHaveBeenCalled();
  });

  it('throws when the payment does not exist', async () => {
    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(PaymentNotFoundError);
    expect(vi.mocked(gateway.createCheckout)).not.toHaveBeenCalled();
  });
});
