import { DomainError, DomainErrorKind } from '@domain/shared/domain-error';

export class LockUnavailableError extends DomainError {
  constructor(key: string) {
    super(
      DomainErrorKind.CONFLICT,
      'RESOURCE_BUSY',
      'The resource is being modified by another request, try again',
      { key },
    );
  }
}
