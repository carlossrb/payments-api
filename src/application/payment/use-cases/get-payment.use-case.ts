import type { PaymentSnapshot } from '@domain/payment/payment';
import { PaymentNotFoundError } from '@domain/payment/payment.errors';
import { Inject, Injectable } from '@nestjs/common';
import { CACHE, type Cache } from '../../shared/ports/cache';
import { PAYMENT_CACHE, paymentCacheKey } from '../payment.const';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../ports/payment.repository';

@Injectable()
export class GetPaymentUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(CACHE) private readonly cache: Cache,
  ) {}

  async execute(paymentId: string): Promise<PaymentSnapshot> {
    const key = paymentCacheKey(paymentId);
    const cached = await this.cache.get<PaymentSnapshot>(key);

    if (cached) return cached;

    const payment = await this.payments.findById(paymentId);

    if (!payment) throw new PaymentNotFoundError(paymentId);

    const snapshot = payment.toSnapshot();

    await this.cache.set(key, snapshot, PAYMENT_CACHE.TTL_SECONDS);

    return snapshot;
  }
}
