export const PAYMENT_GATEWAY = Symbol('PaymentGateway');

export enum GatewayPaymentStatus {
  APPROVED = 'APPROVED',
  AUTHORIZED = 'AUTHORIZED',
  PENDING = 'PENDING',
  IN_PROCESS = 'IN_PROCESS',
  IN_MEDIATION = 'IN_MEDIATION',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  CHARGED_BACK = 'CHARGED_BACK',
  UNKNOWN = 'UNKNOWN',
}

export interface CreateCheckoutInput {
  paymentId: string;
  description: string;
  amount: number;
  cpf: string;
}

export interface CheckoutSession {
  preferenceId: string;
  url: string;
}

export interface GatewayPayment {
  id: string;
  status: GatewayPaymentStatus;
  statusDetail: string | null;
  externalReference: string | null;
}

export interface RawGatewayNotification {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  body: unknown;
}

export interface GatewayNotification {
  notificationId: string | null;
  gatewayPaymentId: string;
}

export interface PaymentGateway {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  getPayment(gatewayPaymentId: string): Promise<GatewayPayment | null>;
  findPaymentByReference(externalReference: string): Promise<GatewayPayment | null>;
  parseNotification(raw: RawGatewayNotification): GatewayNotification | null;
}
