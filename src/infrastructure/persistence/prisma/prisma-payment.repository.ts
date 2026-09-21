import { GatewayPaymentAlreadyLinkedError } from '@application/payment/payment.errors';
import type {
  Page,
  Pagination,
  PaymentFilters,
  PaymentRepository,
} from '@application/payment/ports/payment.repository';
import type { TransactionContext } from '@application/shared/ports/unit-of-work';
import type { Payment } from '@domain/payment/payment';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toDomainPayment, toPaymentRow } from './payment.mapper';
import { PrismaService } from './prisma.service';

const UNIQUE_VIOLATION = 'P2002';

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;

const buildWhere = (filters: PaymentFilters): Prisma.PaymentWhereInput => ({
  ...(filters.cpf && { cpf: filters.cpf }),
  ...(filters.paymentMethod && { paymentMethod: filters.paymentMethod }),
  ...(filters.status && { status: filters.status }),
});

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(payment: Payment, tx?: TransactionContext): Promise<void> {
    const client = (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
    const row = toPaymentRow(payment);

    try {
      await client.payment.upsert({ where: { id: row.id }, create: row, update: row });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new GatewayPaymentAlreadyLinkedError(payment.gatewayPaymentId);

      throw error;
    }
  }

  async findById(id: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { id } });

    if (!row) return null;

    return toDomainPayment(row);
  }

  async findMany(filters: PaymentFilters, { page, limit }: Pagination): Promise<Page<Payment>> {
    const where = buildWhere(filters);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items: rows.map(toDomainPayment), total, page, limit };
  }
}
