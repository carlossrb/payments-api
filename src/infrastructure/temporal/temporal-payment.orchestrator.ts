import { setTimeout as sleep } from 'node:timers/promises';
import type { CheckoutSession, GatewayPayment } from '@application/payment/ports/payment-gateway';
import type { PaymentOrchestrator } from '@application/payment/ports/payment-orchestrator';
import type { EnvironmentVariables } from '@infrastructure/config/env';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  WorkflowExecutionAlreadyStartedError,
  WorkflowIdReusePolicy,
  WorkflowNotFoundError,
} from '@temporalio/client';
import { creditCardWorkflowId, TEMPORAL, TEMPORAL_CLIENT } from './temporal.const';
import {
  awaitCheckoutUpdate,
  type CreditCardPaymentInput,
  cancelSignal,
  gatewayPaymentSignal,
} from './workflows/credit-card-payment.definitions';
import type { creditCardPaymentWorkflow } from './workflows/credit-card-payment.workflow';

@Injectable()
export class TemporalPaymentOrchestrator implements PaymentOrchestrator {
  private readonly logger = new Logger(TemporalPaymentOrchestrator.name);
  constructor(
    @Inject(TEMPORAL_CLIENT) private readonly client: Client,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async startCreditCardPayment(paymentId: string): Promise<void> {
    const input: CreditCardPaymentInput = {
      paymentId,
      checkoutTtlMinutes: this.config.getOrThrow('CHECKOUT_TTL_MINUTES'),
      pollIntervalSeconds: this.config.getOrThrow('CHECKOUT_POLL_INTERVAL_SECONDS'),
    };

    try {
      await this.client.workflow.start<typeof creditCardPaymentWorkflow>(
        TEMPORAL.CREDIT_CARD_WORKFLOW,
        {
          workflowId: creditCardWorkflowId(paymentId),
          workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE_FAILED_ONLY,
          taskQueue: this.config.getOrThrow('TEMPORAL_TASK_QUEUE'),
          args: [input],
        },
      );
      this.logger.log(`Workflow started for payment ${paymentId}`);
    } catch (error) {
      if (error instanceof WorkflowExecutionAlreadyStartedError) return;

      throw error;
    }
  }

  async awaitCheckout(paymentId: string, timeoutMs: number): Promise<CheckoutSession | null> {
    const handle = this.client.workflow.getHandle(creditCardWorkflowId(paymentId));
    const update = handle.executeUpdate(awaitCheckoutUpdate).catch((error: Error) => {
      this.logger.warn(`Could not wait for the checkout of payment ${paymentId}: ${error.message}`);

      return null;
    });
    const timeout = sleep(timeoutMs, null);

    return Promise.race([update, timeout]);
  }

  async notifyGatewayPayment(paymentId: string, gatewayPayment: GatewayPayment): Promise<boolean> {
    try {
      await this.client.workflow
        .getHandle(creditCardWorkflowId(paymentId))
        .signal(gatewayPaymentSignal, gatewayPayment);

      return true;
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) return false;

      throw error;
    }
  }

  async cancel(paymentId: string): Promise<void> {
    try {
      await this.client.workflow.getHandle(creditCardWorkflowId(paymentId)).signal(cancelSignal);
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) return;

      throw error;
    }
  }
}
