export enum DomainErrorKind {
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE = 'UNPROCESSABLE',
  UNAUTHORIZED = 'UNAUTHORIZED',
  DEPENDENCY = 'DEPENDENCY',
}

export abstract class DomainError extends Error {
  readonly kind: DomainErrorKind;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  protected constructor(
    kind: DomainErrorKind,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
    this.kind = kind;
    this.code = code;
    this.details = details;
  }
}
