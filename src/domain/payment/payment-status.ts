export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAIL = 'FAIL',
}

export const PAYMENT_STATUS_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> =
  {
    [PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.FAIL],
    [PaymentStatus.PAID]: [],
    [PaymentStatus.FAIL]: [],
  };

export const canTransition = (from: PaymentStatus, to: PaymentStatus): boolean =>
  PAYMENT_STATUS_TRANSITIONS[from].includes(to);

export const isFinalStatus = (status: PaymentStatus): boolean =>
  PAYMENT_STATUS_TRANSITIONS[status].length === 0;
