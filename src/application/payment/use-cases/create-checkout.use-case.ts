import { CheckoutNotAllowedError, PaymentNotFoundError } from '@domain/payment/payment.errors';
import { Inject, Injectable } from '@nestjs/common';
import { CACHE, type Cache } from '../../shared/ports/cache';
import { paymentCacheKey } from '../payment.const';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../ports/payment.repository';
import {
  type CheckoutSession,
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../ports/payment-gateway';

@Injectable()
export class CreateCheckoutUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(CACHE) private readonly cache: Cache,
  ) {}

  async execute(paymentId: string): Promise<CheckoutSession> {
    const payment = await this.payments.findById(paymentId);

    if (!payment) throw new PaymentNotFoundError(paymentId);
    if (payment.checkout) return payment.checkout;
    if (!payment.isPending) throw new CheckoutNotAllowedError(`payment is ${payment.status}`);

    const checkout = await this.gateway.createCheckout({
      paymentId: payment.id,
      description: payment.description,
      amount: payment.amount.toDecimal(),
      cpf: payment.cpf.value,
    });

    payment.attachCheckout(checkout);

    await this.payments.save(payment);
    await this.cache.del(paymentCacheKey(paymentId));

    return checkout;
  }
}
