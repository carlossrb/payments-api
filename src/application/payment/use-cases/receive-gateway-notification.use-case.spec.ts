import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PAYMENT_EVENTS } from '../payment.const';
import { InvalidGatewayNotificationError } from '../payment.errors';
import { buildGatewayStub, InMemoryCache, RecordingOutbox } from '../testing/fakes';
import { ReceiveGatewayNotificationUseCase } from './receive-gateway-notification.use-case';

const raw = { headers: {}, query: {}, body: {} };

describe('ReceiveGatewayNotificationUseCase', () => {
  let gateway: ReturnType<typeof buildGatewayStub>;
  let outbox: RecordingOutbox;
  let cache: InMemoryCache;
  let useCase: ReceiveGatewayNotificationUseCase;

  beforeEach(() => {
    gateway = buildGatewayStub();
    outbox = new RecordingOutbox();
    cache = new InMemoryCache();
    useCase = new ReceiveGatewayNotificationUseCase(gateway, outbox, cache);
  });

  it('queues a payment notification in the outbox', async () => {
    vi.mocked(gateway.parseNotification).mockReturnValue({
      notificationId: 'n-1',
      gatewayPaymentId: 'mp-1',
    });

    await expect(useCase.execute(raw)).resolves.toBe('QUEUED');
    expect(outbox.events).toEqual([
      { name: PAYMENT_EVENTS.GATEWAY_NOTIFICATION_RECEIVED, payload: { gatewayPaymentId: 'mp-1' } },
    ]);
  });

  it('deduplicates notifications by id', async () => {
    vi.mocked(gateway.parseNotification).mockReturnValue({
      notificationId: 'n-1',
      gatewayPaymentId: 'mp-1',
    });

    await useCase.execute(raw);

    await expect(useCase.execute(raw)).resolves.toBe('DUPLICATE');
    expect(outbox.events).toHaveLength(1);
  });

  it('queues notifications without an id every time', async () => {
    vi.mocked(gateway.parseNotification).mockReturnValue({
      notificationId: null,
      gatewayPaymentId: 'mp-1',
    });

    await useCase.execute(raw);
    await useCase.execute(raw);

    expect(outbox.events).toHaveLength(2);
  });

  it('ignores notifications the gateway adapter does not care about', async () => {
    await expect(useCase.execute(raw)).resolves.toBe('IGNORED');
    expect(outbox.events).toHaveLength(0);
  });

  it('propagates signature failures', async () => {
    vi.mocked(gateway.parseNotification).mockImplementation(() => {
      throw new InvalidGatewayNotificationError('signature mismatch');
    });

    await expect(useCase.execute(raw)).rejects.toBeInstanceOf(InvalidGatewayNotificationError);
  });
});
