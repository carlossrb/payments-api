import { PaymentStatus } from '@domain/payment/payment-status';
import { describe, expect, it } from 'vitest';
import { resolvePaymentOutcome } from './gateway-outcome';
import { GatewayPaymentStatus } from './ports/payment-gateway';

const gatewayPayment = (status: GatewayPaymentStatus, statusDetail: string | null = null) => ({
  id: 'mp-1',
  status,
  statusDetail,
  externalReference: 'payment-1',
});

describe('resolvePaymentOutcome', () => {
  it('maps approved to PAID', () => {
    expect(resolvePaymentOutcome(gatewayPayment(GatewayPaymentStatus.APPROVED))).toEqual({
      status: PaymentStatus.PAID,
      gatewayPaymentId: 'mp-1',
      reason: null,
    });
  });

  it.each([GatewayPaymentStatus.REJECTED, GatewayPaymentStatus.CANCELLED])(
    'maps %s to FAIL keeping the gateway detail as reason',
    (status) => {
      expect(resolvePaymentOutcome(gatewayPayment(status, 'cc_rejected_high_risk'))).toEqual({
        status: PaymentStatus.FAIL,
        gatewayPaymentId: 'mp-1',
        reason: 'cc_rejected_high_risk',
      });
    },
  );

  it('falls back to the gateway status when there is no detail', () => {
    expect(resolvePaymentOutcome(gatewayPayment(GatewayPaymentStatus.REJECTED))?.reason).toBe(
      GatewayPaymentStatus.REJECTED,
    );
  });

  it.each([
    GatewayPaymentStatus.PENDING,
    GatewayPaymentStatus.IN_PROCESS,
    GatewayPaymentStatus.AUTHORIZED,
    GatewayPaymentStatus.IN_MEDIATION,
    GatewayPaymentStatus.REFUNDED,
    GatewayPaymentStatus.CHARGED_BACK,
    GatewayPaymentStatus.UNKNOWN,
  ])('keeps waiting on %s', (status) => {
    expect(resolvePaymentOutcome(gatewayPayment(status))).toBeNull();
  });
});
