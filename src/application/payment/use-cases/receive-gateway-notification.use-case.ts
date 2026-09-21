import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE, type Cache } from '../../shared/ports/cache';
import { EVENT_OUTBOX, type EventOutbox } from '../../shared/ports/event-outbox';
import { notificationDedupeKey, PAYMENT_CACHE, PAYMENT_EVENTS } from '../payment.const';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
  type RawGatewayNotification,
} from '../ports/payment-gateway';

export type ReceiveGatewayNotificationResult = 'QUEUED' | 'DUPLICATE' | 'IGNORED';

@Injectable()
export class ReceiveGatewayNotificationUseCase {
  private readonly logger = new Logger(ReceiveGatewayNotificationUseCase.name);

  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @Inject(EVENT_OUTBOX) private readonly outbox: EventOutbox,
    @Inject(CACHE) private readonly cache: Cache,
  ) {}

  async execute(raw: RawGatewayNotification): Promise<ReceiveGatewayNotificationResult> {
    const notification = this.gateway.parseNotification(raw);

    if (!notification) return 'IGNORED';

    if (notification.notificationId) {
      const firstSeen = await this.cache.setIfAbsent(
        notificationDedupeKey(notification.notificationId),
        true,
        PAYMENT_CACHE.NOTIFICATION_DEDUPE_TTL_SECONDS,
      );

      if (!firstSeen) {
        this.logger.log(`Notification ${notification.notificationId} already received, skipping`);

        return 'DUPLICATE';
      }
    }

    await this.outbox.enqueue({
      name: PAYMENT_EVENTS.GATEWAY_NOTIFICATION_RECEIVED,
      payload: { gatewayPaymentId: notification.gatewayPaymentId },
    });

    return 'QUEUED';
  }
}
