import { PAYMENT_EVENTS } from '@application/payment/payment.const';
import { SyncGatewayNotificationUseCase } from '@application/payment/use-cases/sync-gateway-notification.use-case';
import { Injectable } from '@nestjs/common';
import { OUTBOX } from '../outbox.const';
import type { OutboxHandler } from '../outbox-handler';
import type { OutboxEventRecord } from '../outbox-store';

@Injectable()
export class SyncGatewayNotificationHandler implements OutboxHandler {
  readonly name = 'sync-gateway-notification';
  readonly eventNames = [PAYMENT_EVENTS.GATEWAY_NOTIFICATION_RECEIVED];
  readonly maxAttempts = OUTBOX.MAX_ATTEMPTS;

  constructor(private readonly syncGatewayNotification: SyncGatewayNotificationUseCase) {}

  async handle(event: OutboxEventRecord): Promise<void> {
    const gatewayPaymentId = event.payload.gatewayPaymentId;

    if (typeof gatewayPaymentId !== 'string')
      throw new Error('Outbox payload without gatewayPaymentId');

    await this.syncGatewayNotification.execute(gatewayPaymentId);
  }
}
