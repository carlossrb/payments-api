import { GatewayPaymentStatus } from '@application/payment/ports/payment-gateway';

export const MERCADO_PAGO = {
  CURRENCY: 'BRL',
  IDENTIFICATION_TYPE: 'CPF',
  NOTIFICATION_TYPE_PAYMENT: 'payment',
  MAX_INSTALLMENTS: 12,
  EXCLUDED_PAYMENT_TYPES: ['ticket', 'bank_transfer', 'atm', 'debit_card', 'prepaid_card'],
  SIGNATURE_TOLERANCE_SECONDS: 300,
  PATHS: {
    PREFERENCES: '/checkout/preferences',
    PAYMENT: (id: string) => `/v1/payments/${encodeURIComponent(id)}`,
    PAYMENT_SEARCH: '/v1/payments/search',
  },
} as const;

export const MERCADO_PAGO_STATUS: Readonly<Record<string, GatewayPaymentStatus>> = {
  approved: GatewayPaymentStatus.APPROVED,
  authorized: GatewayPaymentStatus.AUTHORIZED,
  pending: GatewayPaymentStatus.PENDING,
  in_process: GatewayPaymentStatus.IN_PROCESS,
  in_mediation: GatewayPaymentStatus.IN_MEDIATION,
  rejected: GatewayPaymentStatus.REJECTED,
  cancelled: GatewayPaymentStatus.CANCELLED,
  refunded: GatewayPaymentStatus.REFUNDED,
  charged_back: GatewayPaymentStatus.CHARGED_BACK,
};
