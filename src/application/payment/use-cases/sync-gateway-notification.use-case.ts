import { Inject, Injectable, Logger } from '@nestjs/common';
import { resolvePaymentOutcome } from '../gateway-outcome';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '../ports/payment.repository';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../ports/payment-gateway';
import { PAYMENT_ORCHESTRATOR, type PaymentOrchestrator } from '../ports/payment-orchestrator';
import { SettlePaymentUseCase } from './settle-payment.use-case';

export type SyncGatewayNotificationResult = 'SIGNALED' | 'SETTLED' | 'IGNORED';

@Injectable()
export class SyncGatewayNotificationUseCase {
  private readonly logger = new Logger(SyncGatewayNotificationUseCase.name);

  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(PAYMENT_ORCHESTRATOR) private readonly orchestrator: PaymentOrchestrator,
    private readonly settlePayment: SettlePaymentUseCase,
  ) {}

  async execute(gatewayPaymentId: string): Promise<SyncGatewayNotificationResult> {
    const gatewayPayment = await this.gateway.getPayment(gatewayPaymentId);

    if (!gatewayPayment?.externalReference) {
      this.logger.warn(`Gateway payment ${gatewayPaymentId} has no reference to a local payment`);

      return 'IGNORED';
    }

    const payment = await this.payments.findById(gatewayPayment.externalReference);

    if (!payment?.requiresCheckout || payment.isFinal) return 'IGNORED';

    const delivered = await this.orchestrator.notifyGatewayPayment(payment.id, gatewayPayment);

    if (delivered) return 'SIGNALED';

    const outcome = resolvePaymentOutcome(gatewayPayment);

    if (!outcome) return 'IGNORED';

    this.logger.warn(
      `No running workflow for payment ${payment.id}, settling it directly as ${outcome.status}`,
    );
    await this.settlePayment.execute({ paymentId: payment.id, outcome });

    return 'SETTLED';
  }
}
