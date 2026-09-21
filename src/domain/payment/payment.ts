import { randomUUID } from 'node:crypto';
import { Cpf } from './cpf';
import { Money } from './money';
import {
  CheckoutNotAllowedError,
  ImmutablePaymentFieldError,
  InvalidDescriptionError,
  InvalidStatusTransitionError,
  PaymentAlreadyFinalizedError,
  StatusManagedByGatewayError,
} from './payment.errors';
import { PaymentMethod } from './payment-method';
import { canTransition, isFinalStatus, PaymentStatus } from './payment-status';

export interface Checkout {
  readonly preferenceId: string;
  readonly url: string;
}

export interface CreatePaymentProps {
  cpf: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

export interface UpdatePaymentProps extends CreatePaymentProps {
  status: PaymentStatus;
}

export interface PaymentSnapshot {
  id: string;
  cpf: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  checkout: Checkout | null;
  gatewayPaymentId: string | null;
  failureReason: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentState {
  id: string;
  cpf: Cpf;
  description: string;
  amount: Money;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  checkout: Checkout | null;
  gatewayPaymentId: string | null;
  failureReason: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const MANUAL_FAILURE_REASON = 'MANUAL_UPDATE';

const normalizeDescription = (description: string): string => {
  const trimmed = typeof description === 'string' ? description.trim() : '';

  if (!trimmed) throw new InvalidDescriptionError();

  return trimmed;
};

export class Payment {
  private constructor(private readonly state: PaymentState) {}

  static create(props: CreatePaymentProps, now: Date = new Date()): Payment {
    return new Payment({
      id: randomUUID(),
      cpf: Cpf.create(props.cpf),
      description: normalizeDescription(props.description),
      amount: Money.fromDecimal(props.amount),
      paymentMethod: props.paymentMethod,
      status: PaymentStatus.PENDING,
      checkout: null,
      gatewayPaymentId: null,
      failureReason: null,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(snapshot: PaymentSnapshot): Payment {
    return new Payment({
      ...snapshot,
      cpf: Cpf.create(snapshot.cpf),
      amount: Money.fromDecimal(snapshot.amount),
    });
  }

  get id(): string {
    return this.state.id;
  }

  get cpf(): Cpf {
    return this.state.cpf;
  }

  get description(): string {
    return this.state.description;
  }

  get amount(): Money {
    return this.state.amount;
  }

  get paymentMethod(): PaymentMethod {
    return this.state.paymentMethod;
  }

  get status(): PaymentStatus {
    return this.state.status;
  }

  get checkout(): Checkout | null {
    return this.state.checkout;
  }

  get gatewayPaymentId(): string | null {
    return this.state.gatewayPaymentId;
  }

  get failureReason(): string | null {
    return this.state.failureReason;
  }

  get paidAt(): Date | null {
    return this.state.paidAt;
  }

  get isPending(): boolean {
    return this.state.status === PaymentStatus.PENDING;
  }

  get isFinal(): boolean {
    return isFinalStatus(this.state.status);
  }

  get requiresCheckout(): boolean {
    return this.state.paymentMethod === PaymentMethod.CREDIT_CARD;
  }

  attachCheckout(checkout: Checkout, now: Date = new Date()): void {
    if (!this.requiresCheckout)
      throw new CheckoutNotAllowedError('payment method is not credit card');
    if (this.state.checkout) {
      if (this.state.checkout.preferenceId === checkout.preferenceId) return;
      throw new CheckoutNotAllowedError('payment already has a checkout');
    }
    if (!this.isPending) throw new CheckoutNotAllowedError(`payment is ${this.state.status}`);

    this.state.checkout = { ...checkout };
    this.touch(now);
  }

  markAsPaid(input: { gatewayPaymentId?: string | null }, now: Date = new Date()): void {
    this.transitionTo(PaymentStatus.PAID);
    this.state.gatewayPaymentId = input.gatewayPaymentId ?? this.state.gatewayPaymentId;
    this.state.failureReason = null;
    this.state.paidAt = now;
    this.touch(now);
  }

  markAsFailed(
    input: { reason: string; gatewayPaymentId?: string | null },
    now: Date = new Date(),
  ): void {
    this.transitionTo(PaymentStatus.FAIL);
    this.state.gatewayPaymentId = input.gatewayPaymentId ?? this.state.gatewayPaymentId;
    this.state.failureReason = input.reason;
    this.touch(now);
  }

  update(props: UpdatePaymentProps, now: Date = new Date()): void {
    if (props.paymentMethod !== this.state.paymentMethod) {
      throw new ImmutablePaymentFieldError('paymentMethod', 'payment method is fixed at creation');
    }

    const cpf = Cpf.create(props.cpf);
    const amount = Money.fromDecimal(props.amount);
    const description = normalizeDescription(props.description);
    const cpfChanged = !cpf.equals(this.state.cpf);
    const amountChanged = !amount.equals(this.state.amount);
    const descriptionChanged = description !== this.state.description;
    const statusChanged = props.status !== this.state.status;
    const changed = cpfChanged || amountChanged || descriptionChanged || statusChanged;

    if (!changed) return;
    if (this.isFinal) throw new PaymentAlreadyFinalizedError(this.state.status);

    this.assertCheckoutFieldsUntouched(cpfChanged, amountChanged);

    this.state.cpf = cpf;
    this.state.amount = amount;
    this.state.description = description;

    if (statusChanged) this.applyManualStatus(props.status, now);

    this.touch(now);
  }

  toSnapshot(): PaymentSnapshot {
    return {
      id: this.state.id,
      cpf: this.state.cpf.value,
      description: this.state.description,
      amount: this.state.amount.toDecimal(),
      paymentMethod: this.state.paymentMethod,
      status: this.state.status,
      checkout: this.state.checkout ? { ...this.state.checkout } : null,
      gatewayPaymentId: this.state.gatewayPaymentId,
      failureReason: this.state.failureReason,
      paidAt: this.state.paidAt,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
    };
  }

  private assertCheckoutFieldsUntouched(cpfChanged: boolean, amountChanged: boolean): void {
    if (!this.state.checkout) return;

    const reason = 'a checkout was already created with the current value';

    if (amountChanged) throw new ImmutablePaymentFieldError('amount', reason);
    if (cpfChanged) throw new ImmutablePaymentFieldError('cpf', reason);
  }

  private applyManualStatus(status: PaymentStatus, now: Date): void {
    if (status === PaymentStatus.PAID) {
      if (this.requiresCheckout) throw new StatusManagedByGatewayError();
      this.markAsPaid({}, now);
      return;
    }

    if (status === PaymentStatus.FAIL) {
      this.markAsFailed({ reason: MANUAL_FAILURE_REASON }, now);
      return;
    }

    throw new InvalidStatusTransitionError(this.state.status, status);
  }

  private transitionTo(status: PaymentStatus): void {
    if (!canTransition(this.state.status, status)) {
      throw new InvalidStatusTransitionError(this.state.status, status);
    }

    this.state.status = status;
  }

  private touch(now: Date): void {
    this.state.updatedAt = now;
  }
}
