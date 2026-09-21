import { PAYMENT_REPOSITORY } from '@application/payment/ports/payment.repository';
import { EVENT_OUTBOX } from '@application/shared/ports/event-outbox';
import { UNIT_OF_WORK } from '@application/shared/ports/unit-of-work';
import { OUTBOX_STORE } from '@infrastructure/outbox/outbox-store';
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaOutboxRepository } from './prisma-outbox.repository';
import { PrismaPaymentRepository } from './prisma-payment.repository';
import { PrismaUnitOfWork } from './prisma-unit-of-work';

@Module({
  providers: [
    PrismaService,
    PrismaOutboxRepository,
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    { provide: EVENT_OUTBOX, useExisting: PrismaOutboxRepository },
    { provide: OUTBOX_STORE, useExisting: PrismaOutboxRepository },
  ],
  exports: [PrismaService, PAYMENT_REPOSITORY, UNIT_OF_WORK, EVENT_OUTBOX, OUTBOX_STORE],
})
export class PersistenceModule {}
