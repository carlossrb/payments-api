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
