import { GatewayPaymentStatus } from '@application/payment/ports/payment-gateway';
import { describe, expect, it } from 'vitest';
import { MERCADO_PAGO } from './mercado-pago.const';
import { buildPreferenceRequest, mapGatewayStatus, toGatewayPayment } from './mercado-pago.mapper';

describe('mapGatewayStatus', () => {
  it.each([
    ['approved', GatewayPaymentStatus.APPROVED],
    ['rejected', GatewayPaymentStatus.REJECTED],
    ['in_process', GatewayPaymentStatus.IN_PROCESS],
    ['cancelled', GatewayPaymentStatus.CANCELLED],
    ['something_new', GatewayPaymentStatus.UNKNOWN],
    [undefined, GatewayPaymentStatus.UNKNOWN],
  ])('maps %s', (raw, expected) => {
    expect(mapGatewayStatus(raw)).toBe(expected);
  });
});

describe('toGatewayPayment', () => {
  it('normalizes the Mercado Pago payment', () => {
    expect(
      toGatewayPayment({
        id: 123,
        status: 'approved',
        status_detail: 'accredited',
        external_reference: 'p-1',
      }),
    ).toEqual({
      id: '123',
      status: GatewayPaymentStatus.APPROVED,
      statusDetail: 'accredited',
      externalReference: 'p-1',
    });
  });

  it('tolerates missing fields', () => {
    expect(toGatewayPayment({ id: 'abc' })).toEqual({
      id: 'abc',
      status: GatewayPaymentStatus.UNKNOWN,
      statusDetail: null,
      externalReference: null,
    });
  });
});

describe('buildPreferenceRequest', () => {
  const input = { paymentId: 'p-1', description: 'Card charge', amount: 250.5, cpf: '52998224725' };
  const expiresAt = new Date('2026-09-22T12:00:00.000Z');

  it('builds a credit card only preference tied to the payment', () => {
    const request = buildPreferenceRequest(input, {
      notificationUrl: 'https://api/webhooks/mercado-pago',
      expiresAt,
    });

    expect(request.items).toEqual([
      {
        id: 'p-1',
        title: 'Card charge',
        description: 'Card charge',
        quantity: 1,
        currency_id: 'BRL',
        unit_price: 250.5,
      },
    ]);
    expect(request.external_reference).toBe('p-1');
    expect(request.payer.identification).toEqual({ type: 'CPF', number: '52998224725' });
    expect(request.notification_url).toBe('https://api/webhooks/mercado-pago');
    expect(request.payment_methods.excluded_payment_types.map((type) => type.id)).toEqual(
      MERCADO_PAGO.EXCLUDED_PAYMENT_TYPES,
    );
    expect(request.expires).toBe(true);
    expect(request.expiration_date_to).toBe('2026-09-22T12:00:00.000Z');
    expect(request.back_urls).toBeUndefined();
    expect(request.auto_return).toBeUndefined();
  });

  it('adds back urls and auto return when a back url is configured', () => {
    const request = buildPreferenceRequest(input, {
      notificationUrl: 'https://api/webhooks/mercado-pago',
      backUrl: 'https://shop/return',
      expiresAt,
    });

    expect(request.back_urls).toEqual({
      success: 'https://shop/return',
      failure: 'https://shop/return',
      pending: 'https://shop/return',
    });
    expect(request.auto_return).toBe('approved');
  });
});
