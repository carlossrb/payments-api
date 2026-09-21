import { randomUUID } from 'node:crypto';
import type { EventOutbox, OutboxEventInput } from '@application/shared/ports/event-outbox';
import type { TransactionContext } from '@application/shared/ports/unit-of-work';
import type { OutboxEventRecord, OutboxStore } from '@infrastructure/outbox/outbox-store';
import { Injectable } from '@nestjs/common';
import { OutboxEventStatus, type OutboxEvent as OutboxRow, type Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

const toRecord = (row: OutboxRow): OutboxEventRecord => ({
  id: row.id,
  eventName: row.eventName,
  payload: row.payload as Record<string, unknown>,
  attempts: row.attempts,
  createdAt: row.createdAt,
});

const truncate = (value: string, max = 1000): string => value.slice(0, max);

@Injectable()
export class PrismaOutboxRepository implements EventOutbox, OutboxStore {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(event: OutboxEventInput, tx?: TransactionContext): Promise<void> {
    const client = (tx as Prisma.TransactionClient | undefined) ?? this.prisma;

    await client.outboxEvent.create({
      data: {
        id: randomUUID(),
        eventName: event.name,
        payload: event.payload as Prisma.InputJsonObject,
      },
    });
  }

  async findPending(
    eventNames: readonly string[],
    batchSize: number,
  ): Promise<OutboxEventRecord[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: {
        status: OutboxEventStatus.PENDING,
        eventName: { in: [...eventNames] },
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    return rows.map(toRecord);
  }

  async claim(id: string): Promise<boolean> {
    const { count } = await this.prisma.outboxEvent.updateMany({
      where: { id, status: OutboxEventStatus.PENDING },
      data: { status: OutboxEventStatus.PROCESSING },
    });

    return count === 1;
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.outboxEvent.updateMany({
      where: { id, status: OutboxEventStatus.PROCESSING },
      data: { status: OutboxEventStatus.PROCESSED, lastError: null },
    });
  }

  async scheduleRetry(
    id: string,
    attempts: number,
    nextAttemptAt: Date,
    error: string,
  ): Promise<void> {
    await this.prisma.outboxEvent.updateMany({
      where: { id, status: OutboxEventStatus.PROCESSING },
      data: {
        status: OutboxEventStatus.PENDING,
        attempts,
        nextAttemptAt,
        lastError: truncate(error),
      },
    });
  }

  async markFailed(id: string, attempts: number, error: string): Promise<void> {
    await this.prisma.outboxEvent.updateMany({
      where: { id, status: OutboxEventStatus.PROCESSING },
      data: { status: OutboxEventStatus.FAILED, attempts, lastError: truncate(error) },
    });
  }

  async findStuck(olderThan: Date, batchSize: number): Promise<OutboxEventRecord[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxEventStatus.PROCESSING, updatedAt: { lt: olderThan } },
      take: batchSize,
    });

    return rows.map(toRecord);
  }
}
