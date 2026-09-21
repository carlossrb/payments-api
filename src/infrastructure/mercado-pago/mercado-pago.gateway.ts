import { InvalidGatewayNotificationError } from '@application/payment/payment.errors';
import type {
  CheckoutSession,
  CreateCheckoutInput,
  GatewayNotification,
  GatewayPayment,
  PaymentGateway,
  RawGatewayNotification,
} from '@application/payment/ports/payment-gateway';
import type { EnvironmentVariables } from '@infrastructure/config/env';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoClient } from './mercado-pago.client';
import { MERCADO_PAGO } from './mercado-pago.const';
import { buildPreferenceRequest, toGatewayPayment } from './mercado-pago.mapper';
import type {
  MercadoPagoPayment,
  MercadoPagoPaymentSearchResponse,
  MercadoPagoPreferenceResponse,
  MercadoPagoWebhookBody,
} from './mercado-pago.types';
import { verifyMercadoPagoSignature } from './mercado-pago-signature';

const MINUTE_MS = 60_000;

const firstString = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return firstString(value[0]);
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (typeof value === 'number') return String(value);

  return undefined;
};

@Injectable()
export class MercadoPagoGateway implements PaymentGateway {
  private readonly logger = new Logger(MercadoPagoGateway.name);
  constructor(
    private readonly client: MercadoPagoClient,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const ttlMinutes = this.config.getOrThrow('CHECKOUT_TTL_MINUTES');
    const body = buildPreferenceRequest(input, {
      notificationUrl: this.config.getOrThrow('MERCADO_PAGO_NOTIFICATION_URL'),
      backUrl: this.config.get('CHECKOUT_BACK_URL', { infer: true }),
      expiresAt: new Date(Date.now() + ttlMinutes * MINUTE_MS),
    });
    const { data } = await this.client.request<MercadoPagoPreferenceResponse>({
      method: 'POST',
      path: MERCADO_PAGO.PATHS.PREFERENCES,
      body,
      idempotencyKey: input.paymentId,
    });

    if (!data?.id || !data.init_point) {
      throw new InvalidGatewayNotificationError('preference response without id or init_point');
    }

    this.logger.log(`Preference ${data.id} created for payment ${input.paymentId}`);

    return { preferenceId: data.id, url: data.init_point };
  }

  async getPayment(gatewayPaymentId: string): Promise<GatewayPayment | null> {
    const { data } = await this.client.request<MercadoPagoPayment>({
      method: 'GET',
      path: MERCADO_PAGO.PATHS.PAYMENT(gatewayPaymentId),
    });

    if (!data) return null;

    return toGatewayPayment(data);
  }

  async findPaymentByReference(externalReference: string): Promise<GatewayPayment | null> {
    const { data } = await this.client.request<MercadoPagoPaymentSearchResponse>({
      method: 'GET',
      path: MERCADO_PAGO.PATHS.PAYMENT_SEARCH,
      query: { external_reference: externalReference, sort: 'date_created', criteria: 'desc' },
    });
    const latest = data?.results?.[0];

    if (!latest) return null;

    return toGatewayPayment(latest);
  }

  parseNotification(raw: RawGatewayNotification): GatewayNotification | null {
    const body = (raw.body ?? {}) as MercadoPagoWebhookBody;
    const dataId = firstString(raw.query['data.id']) ?? firstString(body.data?.id);
    const verification = verifyMercadoPagoSignature({
      xSignature: firstString(raw.headers['x-signature']),
      xRequestId: firstString(raw.headers['x-request-id']),
      dataId,
      secret: this.config.getOrThrow('MERCADO_PAGO_WEBHOOK_SECRET'),
      toleranceSeconds: MERCADO_PAGO.SIGNATURE_TOLERANCE_SECONDS,
    });

    if (!verification.valid) throw new InvalidGatewayNotificationError(verification.reason);

    const type = firstString(raw.query.type) ?? body.type ?? body.topic;

    if (type !== MERCADO_PAGO.NOTIFICATION_TYPE_PAYMENT) {
      this.logger.log(`Ignoring Mercado Pago notification of type ${type ?? 'unknown'}`);

      return null;
    }

    if (!dataId) throw new InvalidGatewayNotificationError('missing data.id');

    return { notificationId: firstString(body.id) ?? null, gatewayPaymentId: dataId };
  }
}
