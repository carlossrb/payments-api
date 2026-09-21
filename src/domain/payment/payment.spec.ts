import { describe, expect, it } from 'vitest';
import { MANUAL_FAILURE_REASON, Payment } from './payment';
import {
  CheckoutNotAllowedError,
  ImmutablePaymentFieldError,
  InvalidCpfError,
  InvalidDescriptionError,
  InvalidStatusTransitionError,
  PaymentAlreadyFinalizedError,
  StatusManagedByGatewayError,
} from './payment.errors';
import { PaymentMethod } from './payment-method';
import { PaymentStatus } from './payment-status';

const CPF = '52998224725';
const OTHER_CPF = '11144477735';

const pix = () =>
  Payment.create({ cpf: CPF, description: ' Pix ', amount: 100, paymentMethod: PaymentMethod.PIX });

const card = () =>
  Payment.create({
    cpf: CPF,
    description: 'Card',
    amount: 250.5,
    paymentMethod: PaymentMethod.CREDIT_CARD,
  });

const representation = (
  payment: Payment,
  overrides: Partial<Parameters<Payment['update']>[0]> = {},
) => ({
  cpf: payment.cpf.value,
  description: payment.description,
  amount: payment.amount.toDecimal(),
  paymentMethod: payment.paymentMethod,
  status: payment.status,
  ...overrides,
});

describe('Payment.create', () => {
  it('starts as PENDING with a generated id and trimmed description', () => {
    const payment = pix();

    expect(payment.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(payment.status).toBe(PaymentStatus.PENDING);
    expect(payment.description).toBe('Pix');
    expect(payment.checkout).toBeNull();
    expect(payment.requiresCheckout).toBe(false);
  });

  it('only credit card payments require a checkout', () => {
    expect(card().requiresCheckout).toBe(true);
  });

  it('validates its inputs', () => {
    expect(() =>
      Payment.create({ cpf: '123', description: 'x', amount: 1, paymentMethod: PaymentMethod.PIX }),
    ).toThrow(InvalidCpfError);
    expect(() =>
      Payment.create({ cpf: CPF, description: '   ', amount: 1, paymentMethod: PaymentMethod.PIX }),
    ).toThrow(InvalidDescriptionError);
  });
});

describe('Payment status transitions', () => {
  it('moves from PENDING to PAID and records the gateway id and paid date', () => {
    const payment = card();
    const at = new Date('2026-09-21T12:00:00Z');

    payment.markAsPaid({ gatewayPaymentId: 'mp-1' }, at);

    expect(payment.status).toBe(PaymentStatus.PAID);
    expect(payment.gatewayPaymentId).toBe('mp-1');
    expect(payment.paidAt).toEqual(at);
    expect(payment.isFinal).toBe(true);
  });

  it('moves from PENDING to FAIL with a reason', () => {
    const payment = card();

    payment.markAsFailed({ reason: 'cc_rejected', gatewayPaymentId: 'mp-2' });

    expect(payment.status).toBe(PaymentStatus.FAIL);
    expect(payment.failureReason).toBe('cc_rejected');
  });

  it('never leaves a final status', () => {
    const paid = pix();
    paid.markAsPaid({});

    expect(() => paid.markAsFailed({ reason: 'late' })).toThrow(InvalidStatusTransitionError);
    expect(() => paid.markAsPaid({})).toThrow(InvalidStatusTransitionError);
  });
});

describe('Payment.attachCheckout', () => {
  it('attaches a checkout to a pending credit card payment', () => {
    const payment = card();

    payment.attachCheckout({ preferenceId: 'pref-1', url: 'https://mp/1' });

    expect(payment.checkout).toEqual({ preferenceId: 'pref-1', url: 'https://mp/1' });
  });

  it('is idempotent for the same preference and rejects a different one', () => {
    const payment = card();

    payment.attachCheckout({ preferenceId: 'pref-1', url: 'https://mp/1' });
    payment.attachCheckout({ preferenceId: 'pref-1', url: 'https://mp/1' });

    expect(() => payment.attachCheckout({ preferenceId: 'pref-2', url: 'https://mp/2' })).toThrow(
      CheckoutNotAllowedError,
    );
  });

  it('rejects checkouts for PIX or finalized payments', () => {
    expect(() => pix().attachCheckout({ preferenceId: 'p', url: 'u' })).toThrow(
      CheckoutNotAllowedError,
    );

    const failed = card();
    failed.markAsFailed({ reason: 'expired' });

    expect(() => failed.attachCheckout({ preferenceId: 'p', url: 'u' })).toThrow(
      CheckoutNotAllowedError,
    );
  });
});

describe('Payment.update', () => {
  it('replaces the editable fields of a pending payment', () => {
    const payment = pix();

    payment.update(representation(payment, { cpf: OTHER_CPF, description: 'New', amount: 42 }));

    expect(payment.cpf.value).toBe(OTHER_CPF);
    expect(payment.description).toBe('New');
    expect(payment.amount.toDecimal()).toBe(42);
    expect(payment.status).toBe(PaymentStatus.PENDING);
  });

  it('confirms a PIX payment manually', () => {
    const payment = pix();

    payment.update(representation(payment, { status: PaymentStatus.PAID }));

    expect(payment.status).toBe(PaymentStatus.PAID);
    expect(payment.paidAt).toBeInstanceOf(Date);
  });

  it('fails a credit card payment manually but never confirms it', () => {
    const failed = card();
    failed.update(representation(failed, { status: PaymentStatus.FAIL }));

    expect(failed.status).toBe(PaymentStatus.FAIL);
    expect(failed.failureReason).toBe(MANUAL_FAILURE_REASON);

    const payment = card();

    expect(() => payment.update(representation(payment, { status: PaymentStatus.PAID }))).toThrow(
      StatusManagedByGatewayError,
    );
  });

  it('keeps the payment method immutable', () => {
    const payment = pix();

    expect(() =>
      payment.update(representation(payment, { paymentMethod: PaymentMethod.CREDIT_CARD })),
    ).toThrow(ImmutablePaymentFieldError);
  });

  it('freezes amount and cpf once a checkout exists', () => {
    const payment = card();
    payment.attachCheckout({ preferenceId: 'pref-1', url: 'https://mp/1' });

    expect(() => payment.update(representation(payment, { amount: 1 }))).toThrow(
      ImmutablePaymentFieldError,
    );
    expect(() => payment.update(representation(payment, { cpf: OTHER_CPF }))).toThrow(
      ImmutablePaymentFieldError,
    );

    payment.update(representation(payment, { description: 'still editable' }));

    expect(payment.description).toBe('still editable');
  });

  it('accepts an identical representation of a finalized payment but rejects changes', () => {
    const payment = pix();
    payment.markAsPaid({});

    expect(() => payment.update(representation(payment))).not.toThrow();
    expect(() => payment.update(representation(payment, { description: 'other' }))).toThrow(
      PaymentAlreadyFinalizedError,
    );
    expect(() =>
      payment.update(representation(payment, { status: PaymentStatus.PENDING })),
    ).toThrow(PaymentAlreadyFinalizedError);
  });
});

describe('Payment.toSnapshot / restore', () => {
  it('round-trips through a snapshot', () => {
    const payment = card();
    payment.attachCheckout({ preferenceId: 'pref-1', url: 'https://mp/1' });

    const restored = Payment.restore(payment.toSnapshot());

    expect(restored.toSnapshot()).toEqual(payment.toSnapshot());
  });
});
