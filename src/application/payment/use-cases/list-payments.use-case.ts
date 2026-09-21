import { Cpf } from '@domain/payment/cpf';
import type { PaymentSnapshot } from '@domain/payment/payment';
import type { PaymentMethod } from '@domain/payment/payment-method';
import type { PaymentStatus } from '@domain/payment/payment-status';
import { Inject, Injectable } from '@nestjs/common';
import { PAGINATION } from '../payment.const';
import {
  PAYMENT_REPOSITORY,
  type Page,
  type PaymentFilters,
  type PaymentRepository,
} from '../ports/payment.repository';

export interface ListPaymentsInput {
  cpf?: string;
  paymentMethod?: PaymentMethod;
  status?: PaymentStatus;
  page?: number;
  limit?: number;
}

const buildFilters = (input: ListPaymentsInput): PaymentFilters => {
  const filters: PaymentFilters = {};

  if (input.cpf) filters.cpf = Cpf.sanitize(input.cpf);
  if (input.paymentMethod) filters.paymentMethod = input.paymentMethod;
  if (input.status) filters.status = input.status;

  return filters;
};

@Injectable()
export class ListPaymentsUseCase {
  constructor(@Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository) {}

  async execute(input: ListPaymentsInput): Promise<Page<PaymentSnapshot>> {
    const page = input.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(input.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const result = await this.payments.findMany(buildFilters(input), { page, limit });

    return { ...result, items: result.items.map((payment) => payment.toSnapshot()) };
  }
}
