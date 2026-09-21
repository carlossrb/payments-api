import {
  type CreateCheckoutInput,
  type GatewayPayment,
  GatewayPaymentStatus,
} from '@application/payment/ports/payment-gateway';
import { MERCADO_PAGO, MERCADO_PAGO_STATUS } from './mercado-pago.const';
import type { MercadoPagoPayment, MercadoPagoPreferenceRequest } from './mercado-pago.types';

export interface PreferenceOptions {
  notificationUrl: string;
  backUrl?: string;
  expiresAt: Date;
}

export const mapGatewayStatus = (status: string | undefined): GatewayPaymentStatus => {
  if (!status) return GatewayPaymentStatus.UNKNOWN;

  return MERCADO_PAGO_STATUS[status] ?? GatewayPaymentStatus.UNKNOWN;
};

export const toGatewayPayment = (payment: MercadoPagoPayment): GatewayPayment => ({
  id: String(payment.id),
  status: mapGatewayStatus(payment.status),
  statusDetail: payment.status_detail ?? null,
  externalReference: payment.external_reference ?? null,
});

const buildBackUrls = (backUrl: string | undefined) => {
  if (!backUrl) return {};

  return {
    back_urls: { success: backUrl, failure: backUrl, pending: backUrl },
    auto_return: 'approved' as const,
  };
};

export const buildPreferenceRequest = (
  input: CreateCheckoutInput,
  options: PreferenceOptions,
): MercadoPagoPreferenceRequest => ({
  items: [
    {
      id: input.paymentId,
      title: input.description,
      description: input.description,
      quantity: 1,
      currency_id: MERCADO_PAGO.CURRENCY,
      unit_price: input.amount,
    },
  ],
  payer: { identification: { type: MERCADO_PAGO.IDENTIFICATION_TYPE, number: input.cpf } },
  external_reference: input.paymentId,
  notification_url: options.notificationUrl,
  payment_methods: {
    excluded_payment_types: MERCADO_PAGO.EXCLUDED_PAYMENT_TYPES.map((id) => ({ id })),
    installments: MERCADO_PAGO.MAX_INSTALLMENTS,
  },
  metadata: { payment_id: input.paymentId },
  expires: true,
  expiration_date_to: options.expiresAt.toISOString(),
  ...buildBackUrls(options.backUrl),
});
