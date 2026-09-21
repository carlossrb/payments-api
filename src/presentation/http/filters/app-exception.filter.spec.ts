import { GatewayUnavailableError } from '@application/payment/payment.errors';
import { PaymentNotFoundError, StatusManagedByGatewayError } from '@domain/payment/payment.errors';
import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { describeDomainError, describeHttpException } from './app-exception.filter';

describe('describeDomainError', () => {
  it('maps the error kind to an HTTP status and keeps the code', () => {
    expect(describeDomainError(new PaymentNotFoundError('p-1'))).toEqual({
      code: 'PAYMENT_NOT_FOUND',
      message: 'Payment p-1 was not found',
      statusCode: HttpStatus.NOT_FOUND,
      details: { paymentId: 'p-1' },
    });
    expect(describeDomainError(new StatusManagedByGatewayError()).statusCode).toBe(
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
    expect(describeDomainError(new GatewayUnavailableError('down')).statusCode).toBe(
      HttpStatus.BAD_GATEWAY,
    );
  });
});

describe('describeHttpException', () => {
  it('turns class-validator messages into a VALIDATION_ERROR with details', () => {
    const exception = new BadRequestException([
      'cpf must be a valid CPF',
      'amount must be positive',
    ]);

    expect(describeHttpException(exception)).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: HttpStatus.BAD_REQUEST,
      details: ['cpf must be a valid CPF', 'amount must be positive'],
    });
  });

  it('uses the HTTP status name as code for other exceptions', () => {
    expect(describeHttpException(new NotFoundException('Cannot GET /nope'))).toEqual({
      code: 'NOT_FOUND',
      message: 'Cannot GET /nope',
      statusCode: HttpStatus.NOT_FOUND,
    });
  });
});
