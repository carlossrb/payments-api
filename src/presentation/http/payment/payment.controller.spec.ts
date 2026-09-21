import { CreatePaymentUseCase } from '@application/payment/use-cases/create-payment.use-case';
import { GetPaymentUseCase } from '@application/payment/use-cases/get-payment.use-case';
import { ListPaymentsUseCase } from '@application/payment/use-cases/list-payments.use-case';
import { UpdatePaymentUseCase } from '@application/payment/use-cases/update-payment.use-case';
import { Payment } from '@domain/payment/payment';
import { PaymentMethod } from '@domain/payment/payment-method';
import { PaymentStatus } from '@domain/payment/payment-status';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentController } from './payment.controller';

const snapshot = () => {
  const payment = Payment.create({
    cpf: '52998224725',
    description: 'Card charge',
    amount: 250.5,
    paymentMethod: PaymentMethod.CREDIT_CARD,
  });
  payment.attachCheckout({ preferenceId: 'pref-1', url: 'https://mp/checkout/pref-1' });

  return payment.toSnapshot();
};

describe('PaymentController', () => {
  const createPayment = { execute: vi.fn() };
  const updatePayment = { execute: vi.fn() };
  const getPayment = { execute: vi.fn() };
  const listPayments = { execute: vi.fn() };
  let controller: PaymentController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: CreatePaymentUseCase, useValue: createPayment },
        { provide: UpdatePaymentUseCase, useValue: updatePayment },
        { provide: GetPaymentUseCase, useValue: getPayment },
        { provide: ListPaymentsUseCase, useValue: listPayments },
      ],
    }).compile();

    controller = moduleRef.get(PaymentController);
  });

  it('creates a payment, sets the Location header and presents the checkout url', async () => {
    const payment = snapshot();
    createPayment.execute.mockResolvedValue(payment);
    const response = { setHeader: vi.fn() };

    const body = await controller.create(
      {
        cpf: '529.982.247-25',
        description: 'Card charge',
        amount: 250.5,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      },
      response as never,
    );

    expect(response.setHeader).toHaveBeenCalledWith('Location', `/api/payment/${payment.id}`);
    expect(body).toMatchObject({
      id: payment.id,
      cpf: '52998224725',
      amount: 250.5,
      status: PaymentStatus.PENDING,
      checkoutUrl: 'https://mp/checkout/pref-1',
      createdAt: payment.createdAt.toISOString(),
    });
  });

  it('passes the id along with the full representation on update', async () => {
    const payment = snapshot();
    updatePayment.execute.mockResolvedValue(payment);
    const dto = {
      cpf: payment.cpf,
      description: payment.description,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: PaymentStatus.FAIL,
    };

    await controller.update(payment.id, dto);

    expect(updatePayment.execute).toHaveBeenCalledWith({ paymentId: payment.id, ...dto });
  });

  it('presents a page with the total number of pages', async () => {
    const payment = snapshot();
    listPayments.execute.mockResolvedValue({ items: [payment], total: 41, page: 2, limit: 20 });

    const body = await controller.list({ page: 2, limit: 20 });

    expect(body).toMatchObject({ total: 41, page: 2, limit: 20, totalPages: 3 });
    expect(body.items[0]?.id).toBe(payment.id);
  });

  it('returns a single payment', async () => {
    const payment = snapshot();
    getPayment.execute.mockResolvedValue(payment);

    await expect(controller.findOne(payment.id)).resolves.toMatchObject({ id: payment.id });
  });
});
