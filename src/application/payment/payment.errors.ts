import { DomainError, DomainErrorKind } from '@domain/shared/domain-error';

export class GatewayUnavailableError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(DomainErrorKind.DEPENDENCY, 'GATEWAY_UNAVAILABLE', message, details);
  }
}

export class GatewayRejectedError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(DomainErrorKind.UNPROCESSABLE, 'GATEWAY_REJECTED', message, details);
  }
}

export class InvalidGatewayNotificationError extends DomainError {
  constructor(reason: string) {
    super(
      DomainErrorKind.UNAUTHORIZED,
      'INVALID_GATEWAY_NOTIFICATION',
      `Gateway notification rejected: ${reason}`,
    );
  }
}

export class GatewayPaymentAlreadyLinkedError extends DomainError {
  constructor(gatewayPaymentId: string | null) {
    super(
      DomainErrorKind.CONFLICT,
      'GATEWAY_PAYMENT_ALREADY_LINKED',
      `Gateway payment ${gatewayPaymentId} is already linked to another payment`,
      { gatewayPaymentId },
    );
  }
}
