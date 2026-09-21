import type { Page } from '@application/payment/ports/payment.repository';
import type { PaymentSnapshot } from '@domain/payment/payment';
import type { PaymentPageResponseDto, PaymentResponseDto } from './dto/payment-response.dto';

const toIso = (value: Date | string | null): string | null => {
  if (value === null) return null;

  return new Date(value).toISOString();
};

export const toPaymentResponse = (payment: PaymentSnapshot): PaymentResponseDto => ({
  id: payment.id,
  cpf: payment.cpf,
  description: payment.description,
  amount: payment.amount,
  paymentMethod: payment.paymentMethod,
  status: payment.status,
  checkoutUrl: payment.checkout?.url ?? null,
  gatewayPaymentId: payment.gatewayPaymentId,
  failureReason: payment.failureReason,
  paidAt: toIso(payment.paidAt),
  createdAt: toIso(payment.createdAt) as string,
  updatedAt: toIso(payment.updatedAt) as string,
});

export const toPaymentPageResponse = (page: Page<PaymentSnapshot>): PaymentPageResponseDto => ({
  items: page.items.map(toPaymentResponse),
  total: page.total,
  page: page.page,
  limit: page.limit,
  totalPages: Math.max(Math.ceil(page.total / page.limit), 1),
});
