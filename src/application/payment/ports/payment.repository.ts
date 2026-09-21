import type { Payment } from '@domain/payment/payment';
import type { PaymentMethod } from '@domain/payment/payment-method';
import type { PaymentStatus } from '@domain/payment/payment-status';
import type { TransactionContext } from '../../shared/ports/unit-of-work';

export const PAYMENT_REPOSITORY = Symbol('PaymentRepository');

export interface PaymentFilters {
  cpf?: string;
  paymentMethod?: PaymentMethod;
  status?: PaymentStatus;
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaymentRepository {
  save(payment: Payment, tx?: TransactionContext): Promise<void>;
  findById(id: string): Promise<Payment | null>;
  findMany(filters: PaymentFilters, pagination: Pagination): Promise<Page<Payment>>;
}
