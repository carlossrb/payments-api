import type { PaymentSnapshot } from '@domain/payment/payment';
import { PaymentNotFoundError } from '@domain/payment/payment.errors';
import { PaymentStatus } from '@domain/payment/payment-status';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE, type Cache } from '../../shared/ports/cache';
import { DISTRIBUTED_LOCK, type DistributedLock } from '../../shared/ports/distributed-lock';
import type { PaymentOutcome } from '../gateway-outcome';
import { PAYMENT_LOCK, paymentCacheKey, paymentLockKey } from '../payment.const';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../ports/payment.repository';

export interface SettlePaymentInput {
  paymentId: string;
  outcome: PaymentOutcome;
}

@Injectable()
export class SettlePaymentUseCase {
  private readonly logger = new Logger(SettlePaymentUseCase.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(CACHE) private readonly cache: Cache,
    @Inject(DISTRIBUTED_LOCK) private readonly lock: DistributedLock,
  ) {}

  async execute({ paymentId, outcome }: SettlePaymentInput): Promise<PaymentSnapshot> {
    return this.lock.withLock(
      paymentLockKey(paymentId),
      async () => {
        const payment = await this.payments.findById(paymentId);

        if (!payment) throw new PaymentNotFoundError(paymentId);

        if (payment.isFinal) {
          this.logger.log(
            `Payment ${paymentId} is already ${payment.status}, ignoring outcome ${outcome.status}`,
          );

          return payment.toSnapshot();
        }

        if (outcome.status === PaymentStatus.PAID) {
          payment.markAsPaid({ gatewayPaymentId: outcome.gatewayPaymentId });
        } else {
          payment.markAsFailed({
            reason: outcome.reason ?? outcome.status,
            gatewayPaymentId: outcome.gatewayPaymentId,
          });
        }

        await this.payments.save(payment);
        await this.cache.del(paymentCacheKey(paymentId));

        return payment.toSnapshot();
      },
      { ttlMs: PAYMENT_LOCK.TTL_MS, waitMs: PAYMENT_LOCK.WAIT_MS },
    );
  }
}
