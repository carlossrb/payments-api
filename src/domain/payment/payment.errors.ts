import { DomainError, DomainErrorKind } from '../shared/domain-error';
import { PaymentStatus } from './payment-status';

export class InvalidCpfError extends DomainError {
  constructor() {
    super(DomainErrorKind.VALIDATION, 'INVALID_CPF', 'CPF is invalid');
  }
}

export class InvalidAmountError extends DomainError {
  constructor(reason: string) {
    super(DomainErrorKind.VALIDATION, 'INVALID_AMOUNT', `Amount is invalid: ${reason}`);
  }
}

export class InvalidDescriptionError extends DomainError {
  constructor() {
    super(DomainErrorKind.VALIDATION, 'INVALID_DESCRIPTION', 'Description must not be empty');
  }
}

export class PaymentNotFoundError extends DomainError {
  constructor(paymentId: string) {
    super(DomainErrorKind.NOT_FOUND, 'PAYMENT_NOT_FOUND', `Payment ${paymentId} was not found`, {
      paymentId,
    });
  }
}

export class InvalidStatusTransitionError extends DomainError {
  constructor(from: PaymentStatus, to: PaymentStatus) {
    super(
      DomainErrorKind.CONFLICT,
      'INVALID_STATUS_TRANSITION',
      `Payment cannot move from ${from} to ${to}`,
      { from, to },
    );
  }
}

export class PaymentAlreadyFinalizedError extends DomainError {
  constructor(status: PaymentStatus) {
    super(
      DomainErrorKind.CONFLICT,
      'PAYMENT_ALREADY_FINALIZED',
      `Payment is ${status} and can no longer be changed`,
      { status },
    );
  }
}

export class ImmutablePaymentFieldError extends DomainError {
  constructor(field: string, reason: string) {
    super(
      DomainErrorKind.UNPROCESSABLE,
      'IMMUTABLE_PAYMENT_FIELD',
      `Field ${field} cannot be changed: ${reason}`,
      { field },
    );
  }
}

export class StatusManagedByGatewayError extends DomainError {
  constructor() {
    super(
      DomainErrorKind.UNPROCESSABLE,
      'STATUS_MANAGED_BY_GATEWAY',
      'Credit card payments are confirmed by the payment gateway, not manually',
    );
  }
}

export class CheckoutNotAllowedError extends DomainError {
  constructor(reason: string) {
    super(
      DomainErrorKind.CONFLICT,
      'CHECKOUT_NOT_ALLOWED',
      `Checkout cannot be attached: ${reason}`,
    );
  }
}
