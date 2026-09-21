import { DomainError, DomainErrorKind } from '@domain/shared/domain-error';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export const HTTP_STATUS_BY_KIND: Readonly<Record<DomainErrorKind, HttpStatus>> = {
  [DomainErrorKind.VALIDATION]: HttpStatus.BAD_REQUEST,
  [DomainErrorKind.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [DomainErrorKind.CONFLICT]: HttpStatus.CONFLICT,
  [DomainErrorKind.UNPROCESSABLE]: HttpStatus.UNPROCESSABLE_ENTITY,
  [DomainErrorKind.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [DomainErrorKind.DEPENDENCY]: HttpStatus.BAD_GATEWAY,
};

const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';

export const describeDomainError = (error: DomainError): ErrorBody => ({
  code: error.code,
  message: error.message,
  statusCode: HTTP_STATUS_BY_KIND[error.kind],
  ...(error.details && { details: error.details }),
});

export const describeHttpException = (exception: HttpException): ErrorBody => {
  const statusCode = exception.getStatus();
  const raw = exception.getResponse();
  const fallbackCode = HttpStatus[statusCode] ?? INTERNAL_ERROR_CODE;

  if (typeof raw === 'string') return { code: fallbackCode, message: raw, statusCode };

  const body = raw as { message?: string | string[]; code?: string };

  if (Array.isArray(body.message)) {
    return {
      code: VALIDATION_ERROR_CODE,
      message: 'Validation failed',
      statusCode,
      details: body.message,
    };
  }

  return {
    code: body.code ?? fallbackCode,
    message: body.message ?? exception.message,
    statusCode,
  };
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const body = this.describe(exception, request);

    response.status(body.statusCode).json({
      ...body,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private describe(exception: unknown, request: Request): ErrorBody {
    if (exception instanceof DomainError) {
      const body = describeDomainError(exception);

      this.logger.warn(
        `${request.method} ${request.url} -> ${body.statusCode} ${body.code}: ${body.message}`,
      );

      return body;
    }

    if (exception instanceof HttpException) {
      const body = describeHttpException(exception);

      this.logger.warn(`${request.method} ${request.url} -> ${body.statusCode} ${body.code}`);

      return body;
    }

    this.logger.error(
      `Unhandled error on ${request.method} ${request.url}: ${(exception as Error)?.message}`,
      (exception as Error)?.stack,
    );

    return {
      code: INTERNAL_ERROR_CODE,
      message: 'Internal server error',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }
}
