import type { PaymentSnapshot, UpdatePaymentProps } from '@domain/payment/payment';
import { PaymentNotFoundError } from '@domain/payment/payment.errors';
import { PaymentStatus } from '@domain/payment/payment-status';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE, type Cache } from '../../shared/ports/cache';
import { DISTRIBUTED_LOCK, type DistributedLock } from '../../shared/ports/distributed-lock';
import { PAYMENT_LOCK, paymentCacheKey, paymentLockKey } from '../payment.const';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../ports/payment.repository';
import { PAYMENT_ORCHESTRATOR, type PaymentOrchestrator } from '../ports/payment-orchestrator';

export interface UpdatePaymentInput extends UpdatePaymentProps {
  paymentId: string;
}

@Injectable()
export class UpdatePaymentUseCase {
  private readonly logger = new Logger(UpdatePaymentUseCase.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(CACHE) private readonly cache: Cache,
    @Inject(DISTRIBUTED_LOCK) private readonly lock: DistributedLock,
    @Inject(PAYMENT_ORCHESTRATOR) private readonly orchestrator: PaymentOrchestrator,
  ) {}

  async execute(input: UpdatePaymentInput): Promise<PaymentSnapshot> {
    const { paymentId, ...props } = input;

    return this.lock.withLock(
      paymentLockKey(paymentId),
      async () => {
        const payment = await this.payments.findById(paymentId);

        if (!payment) throw new PaymentNotFoundError(paymentId);

        const wasPending = payment.isPending;

        payment.update(props);

        await this.payments.save(payment);
        await this.cache.del(paymentCacheKey(paymentId));

        const failedManually = wasPending && payment.status === PaymentStatus.FAIL;

        if (failedManually && payment.requiresCheckout) await this.cancelWorkflow(paymentId);

        return payment.toSnapshot();
      },
      { ttlMs: PAYMENT_LOCK.TTL_MS, waitMs: PAYMENT_LOCK.WAIT_MS },
    );
  }

  private async cancelWorkflow(paymentId: string): Promise<void> {
    try {
      await this.orchestrator.cancel(paymentId);
    } catch (error) {
      this.logger.warn(
        `Payment ${paymentId} was failed manually but its workflow could not be cancelled: ${(error as Error).message}`,
      );
    }
  }
}
