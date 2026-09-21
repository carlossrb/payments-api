import { Payment } from '@domain/payment/payment';
import type { PaymentMethod } from '@domain/payment/payment-method';
import type { PaymentStatus } from '@domain/payment/payment-status';
import type { Payment as PaymentRow, Prisma } from '@prisma/client';

const toCheckout = (row: PaymentRow) => {
  if (!row.checkoutUrl || !row.gatewayPreferenceId) return null;

  return { url: row.checkoutUrl, preferenceId: row.gatewayPreferenceId };
};

export const toDomainPayment = (row: PaymentRow): Payment =>
  Payment.restore({
    id: row.id,
    cpf: row.cpf,
    description: row.description,
    amount: row.amount.toNumber(),
    paymentMethod: row.paymentMethod as PaymentMethod,
    status: row.status as PaymentStatus,
    checkout: toCheckout(row),
    gatewayPaymentId: row.gatewayPaymentId,
    failureReason: row.failureReason,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

export const toPaymentRow = (payment: Payment): Prisma.PaymentUncheckedCreateInput => {
  const snapshot = payment.toSnapshot();

  return {
    id: snapshot.id,
    cpf: snapshot.cpf,
    description: snapshot.description,
    amount: snapshot.amount,
    paymentMethod: snapshot.paymentMethod,
    status: snapshot.status,
    checkoutUrl: snapshot.checkout?.url ?? null,
    gatewayPreferenceId: snapshot.checkout?.preferenceId ?? null,
    gatewayPaymentId: snapshot.gatewayPaymentId,
    failureReason: snapshot.failureReason,
    paidAt: snapshot.paidAt,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
};
