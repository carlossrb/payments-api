import { Payment } from '@domain/payment/payment';
import { PaymentStatus } from '@domain/payment/payment-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayPaymentStatus } from '../ports/payment-gateway';
import {
  buildGatewayStub,
  buildOrchestratorStub,
  creditCardInput,
  InMemoryCache,
  InMemoryPaymentRepository,
  PassthroughLock,
  pixInput,
} from '../testing/fakes';
import { SettlePaymentUseCase } from './settle-payment.use-case';
import { SyncGatewayNotificationUseCase } from './sync-gateway-notification.use-case';

describe('SyncGatewayNotificationUseCase', () => {
  let payments: InMemoryPaymentRepository;
  let gateway: ReturnType<typeof buildGatewayStub>;
  let orchestrator: ReturnType<typeof buildOrchestratorStub>;
  let useCase: SyncGatewayNotificationUseCase;

  const gatewayPayment = (
    externalReference: string | null,
    status = GatewayPaymentStatus.APPROVED,
  ) => ({
    id: 'mp-1',
    status,
    statusDetail: null,
    externalReference,
  });

  beforeEach(() => {
    payments = new InMemoryPaymentRepository();
    gateway = buildGatewayStub();
    orchestrator = buildOrchestratorStub();
    useCase = new SyncGatewayNotificationUseCase(
      gateway,
      payments,
      orchestrator,
      new SettlePaymentUseCase(payments, new InMemoryCache(), new PassthroughLock()),
    );
  });

  it('signals the running workflow with the gateway payment', async () => {
    const payment = Payment.create(creditCardInput());
    await payments.save(payment);
    vi.mocked(gateway.getPayment).mockResolvedValue(gatewayPayment(payment.id));

    await expect(useCase.execute('mp-1')).resolves.toBe('SIGNALED');
    expect(orchestrator.notifyGatewayPayment).toHaveBeenCalledWith(
      payment.id,
      gatewayPayment(payment.id),
    );
    expect(payments.payments.get(payment.id)?.status).toBe(PaymentStatus.PENDING);
  });

  it('settles the payment directly when no workflow is running', async () => {
    const payment = Payment.create(creditCardInput());
    await payments.save(payment);
    vi.mocked(gateway.getPayment).mockResolvedValue(gatewayPayment(payment.id));
    vi.mocked(orchestrator.notifyGatewayPayment).mockResolvedValue(false);

    await expect(useCase.execute('mp-1')).resolves.toBe('SETTLED');
    expect(payments.payments.get(payment.id)?.status).toBe(PaymentStatus.PAID);
  });

  it('ignores non final statuses when no workflow is running', async () => {
    const payment = Payment.create(creditCardInput());
    await payments.save(payment);
    vi.mocked(gateway.getPayment).mockResolvedValue(
      gatewayPayment(payment.id, GatewayPaymentStatus.PENDING),
    );
    vi.mocked(orchestrator.notifyGatewayPayment).mockResolvedValue(false);

    await expect(useCase.execute('mp-1')).resolves.toBe('IGNORED');
  });

  it.each([
    ['unknown gateway payment', null, null],
    ['payment without reference', gatewayPayment(null), null],
    ['unknown local payment', gatewayPayment('missing'), null],
  ])('ignores %s', async (_label, resolved, _unused) => {
    vi.mocked(gateway.getPayment).mockResolvedValue(resolved);

    await expect(useCase.execute('mp-1')).resolves.toBe('IGNORED');
    expect(orchestrator.notifyGatewayPayment).not.toHaveBeenCalled();
  });

  it('ignores PIX and finalized payments', async () => {
    const pix = Payment.create(pixInput());
    await payments.save(pix);
    vi.mocked(gateway.getPayment).mockResolvedValue(gatewayPayment(pix.id));

    await expect(useCase.execute('mp-1')).resolves.toBe('IGNORED');

    const card = Payment.create(creditCardInput());
    card.markAsPaid({});
    await payments.save(card);
    vi.mocked(gateway.getPayment).mockResolvedValue(gatewayPayment(card.id));

    await expect(useCase.execute('mp-1')).resolves.toBe('IGNORED');
    expect(orchestrator.notifyGatewayPayment).not.toHaveBeenCalled();
  });
});
