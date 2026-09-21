import { Payment } from '@domain/payment/payment';
import { PaymentMethod } from '@domain/payment/payment-method';
import { PaymentStatus } from '@domain/payment/payment-status';
import { beforeEach, describe, expect, it } from 'vitest';
import { PAGINATION } from '../payment.const';
import {
  ANOTHER_VALID_CPF,
  creditCardInput,
  InMemoryPaymentRepository,
  pixInput,
  VALID_CPF,
} from '../testing/fakes';
import { ListPaymentsUseCase } from './list-payments.use-case';

describe('ListPaymentsUseCase', () => {
  let payments: InMemoryPaymentRepository;
  let useCase: ListPaymentsUseCase;

  beforeEach(async () => {
    payments = new InMemoryPaymentRepository();
    useCase = new ListPaymentsUseCase(payments);

    await payments.save(Payment.create(pixInput()));
    await payments.save(Payment.create(creditCardInput()));
    await payments.save(Payment.create({ ...pixInput(), cpf: ANOTHER_VALID_CPF }));

    const paid = Payment.create(pixInput());
    paid.markAsPaid({});
    await payments.save(paid);
  });

  it('applies default pagination', async () => {
    const page = await useCase.execute({});

    expect(page).toMatchObject({
      total: 4,
      page: PAGINATION.DEFAULT_PAGE,
      limit: PAGINATION.DEFAULT_LIMIT,
    });
    expect(page.items).toHaveLength(4);
  });

  it('filters by cpf ignoring the mask', async () => {
    const page = await useCase.execute({ cpf: '529.982.247-25' });

    expect(page.total).toBe(3);
    expect(page.items.every((item) => item.cpf === VALID_CPF)).toBe(true);
  });

  it('filters by payment method and status', async () => {
    expect((await useCase.execute({ paymentMethod: PaymentMethod.CREDIT_CARD })).total).toBe(1);
    expect((await useCase.execute({ status: PaymentStatus.PAID })).total).toBe(1);
    expect(
      (await useCase.execute({ paymentMethod: PaymentMethod.PIX, status: PaymentStatus.PENDING }))
        .total,
    ).toBe(2);
  });

  it('caps the page size and paginates', async () => {
    const page = await useCase.execute({ page: 2, limit: 3 });

    expect(page.items).toHaveLength(1);
    expect(page.page).toBe(2);

    const capped = await useCase.execute({ limit: PAGINATION.MAX_LIMIT + 50 });

    expect(capped.limit).toBe(PAGINATION.MAX_LIMIT);
  });
});
