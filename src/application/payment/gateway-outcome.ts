import { PaymentStatus } from '@domain/payment/payment-status';
import { type GatewayPayment, GatewayPaymentStatus } from './ports/payment-gateway';

export type FinalPaymentStatus = PaymentStatus.PAID | PaymentStatus.FAIL;

export interface PaymentOutcome {
  status: FinalPaymentStatus;
  gatewayPaymentId: string | null;
  reason: string | null;
}

const FINAL_STATUS_BY_GATEWAY_STATUS: Readonly<
  Partial<Record<GatewayPaymentStatus, FinalPaymentStatus>>
> = {
  [GatewayPaymentStatus.APPROVED]: PaymentStatus.PAID,
  [GatewayPaymentStatus.REJECTED]: PaymentStatus.FAIL,
  [GatewayPaymentStatus.CANCELLED]: PaymentStatus.FAIL,
};

export const resolvePaymentOutcome = (gatewayPayment: GatewayPayment): PaymentOutcome | null => {
  const status = FINAL_STATUS_BY_GATEWAY_STATUS[gatewayPayment.status];

  if (!status) return null;

  const reason =
    status === PaymentStatus.FAIL ? (gatewayPayment.statusDetail ?? gatewayPayment.status) : null;

  return { status, gatewayPaymentId: gatewayPayment.id, reason };
};
