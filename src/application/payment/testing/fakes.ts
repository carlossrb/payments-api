import type { Payment } from '@domain/payment/payment';
import { PaymentMethod } from '@domain/payment/payment-method';
import { vi } from 'vitest';
import type { Cache } from '../../shared/ports/cache';
import type { DistributedLock, LockOptions } from '../../shared/ports/distributed-lock';
import type { EventOutbox, OutboxEventInput } from '../../shared/ports/event-outbox';
import type { TransactionContext, UnitOfWork } from '../../shared/ports/unit-of-work';
import type {
  Page,
  Pagination,
  PaymentFilters,
  PaymentRepository,
} from '../ports/payment.repository';
import type {
  CheckoutSession,
  GatewayNotification,
  GatewayPayment,
  PaymentGateway,
  RawGatewayNotification,
} from '../ports/payment-gateway';
import type { PaymentOrchestrator } from '../ports/payment-orchestrator';

export const VALID_CPF = '52998224725';
export const ANOTHER_VALID_CPF = '11144477735';

export class InMemoryPaymentRepository implements PaymentRepository {
  readonly payments = new Map<string, Payment>();
  readonly saved: Payment[] = [];

  async save(payment: Payment, _tx?: TransactionContext): Promise<void> {
    this.payments.set(payment.id, payment);
    this.saved.push(payment);
  }

  async findById(id: string): Promise<Payment | null> {
    return this.payments.get(id) ?? null;
  }

  async findMany(filters: PaymentFilters, pagination: Pagination): Promise<Page<Payment>> {
    const matches = [...this.payments.values()].filter(
      (payment) =>
        (!filters.cpf || payment.cpf.value === filters.cpf) &&
        (!filters.paymentMethod || payment.paymentMethod === filters.paymentMethod) &&
        (!filters.status || payment.status === filters.status),
    );
    const start = (pagination.page - 1) * pagination.limit;

    return {
      items: matches.slice(start, start + pagination.limit),
      total: matches.length,
      page: pagination.page,
      limit: pagination.limit,
    };
  }
}

export class InMemoryCache implements Cache {
  readonly entries = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.entries.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.entries.set(key, value);
  }

  async setIfAbsent<T>(key: string, value: T): Promise<boolean> {
    if (this.entries.has(key)) return false;

    this.entries.set(key, value);

    return true;
  }

  async del(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

export class PassthroughLock implements DistributedLock {
  readonly acquired: string[] = [];

  async withLock<T>(key: string, task: () => Promise<T>, _options?: LockOptions): Promise<T> {
    this.acquired.push(key);

    return task();
  }
}

export class RecordingOutbox implements EventOutbox {
  readonly events: OutboxEventInput[] = [];

  async enqueue(event: OutboxEventInput, _tx?: TransactionContext): Promise<void> {
    this.events.push(event);
  }
}

export class ImmediateUnitOfWork implements UnitOfWork {
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return work({});
  }
}

export const buildGatewayStub = (overrides: Partial<PaymentGateway> = {}): PaymentGateway => ({
  createCheckout: vi.fn(
    async (): Promise<CheckoutSession> => ({
      preferenceId: 'pref-1',
      url: 'https://mp/checkout/pref-1',
    }),
  ),
  getPayment: vi.fn(async (): Promise<GatewayPayment | null> => null),
  findPaymentByReference: vi.fn(async (): Promise<GatewayPayment | null> => null),
  parseNotification: vi.fn((_raw: RawGatewayNotification): GatewayNotification | null => null),
  ...overrides,
});

export const buildOrchestratorStub = (
  overrides: Partial<PaymentOrchestrator> = {},
): PaymentOrchestrator => ({
  startCreditCardPayment: vi.fn(async () => undefined),
  awaitCheckout: vi.fn(async (): Promise<CheckoutSession | null> => null),
  notifyGatewayPayment: vi.fn(async () => true),
  cancel: vi.fn(async () => undefined),
  ...overrides,
});

export const pixInput = () => ({
  cpf: VALID_CPF,
  description: 'Pix charge',
  amount: 100,
  paymentMethod: PaymentMethod.PIX,
});

export const creditCardInput = () => ({
  cpf: VALID_CPF,
  description: 'Card charge',
  amount: 250.5,
  paymentMethod: PaymentMethod.CREDIT_CARD,
});
