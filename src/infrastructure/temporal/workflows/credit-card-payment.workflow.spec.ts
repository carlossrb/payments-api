import { resolve } from 'node:path';
import {
  type GatewayPayment,
  GatewayPaymentStatus,
} from '@application/payment/ports/payment-gateway';
import { PaymentStatus } from '@domain/payment/payment-status';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TEMPORAL } from '../temporal.const';
import {
  awaitCheckoutUpdate,
  CHECKOUT_FAILURE_REASONS,
  type CreditCardPaymentInput,
  cancelSignal,
  checkoutQuery,
  gatewayPaymentSignal,
} from './credit-card-payment.definitions';
import type { creditCardPaymentWorkflow } from './credit-card-payment.workflow';

const TASK_QUEUE = 'payments-test';
const SRC_ROOT = resolve(__dirname, '../../..');
const CHECKOUT = { preferenceId: 'pref-1', url: 'https://mp/checkout/pref-1' };

const input = (paymentId: string): CreditCardPaymentInput => ({
  paymentId,
  checkoutTtlMinutes: 60,
  pollIntervalSeconds: 60,
});

const buildActivities = () => ({
  createCheckout: vi.fn(async () => CHECKOUT),
  findGatewayPayment: vi.fn<(input: { paymentId: string }) => Promise<GatewayPayment | null>>(
    async () => null,
  ),
  settlePayment: vi.fn(async () => undefined),
});

describe('creditCardPaymentWorkflow', () => {
  let env: TestWorkflowEnvironment;
  const activities = buildActivities();

  beforeAll(async () => {
    Runtime.install({ logger: new DefaultLogger('WARN') });
    env = await TestWorkflowEnvironment.createTimeSkipping();
  }, 120_000);

  afterAll(async () => {
    await env?.teardown();
  });

  const runWorker = <T>(fn: () => Promise<T>) =>
    Worker.create({
      connection: env.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath: resolve(__dirname, 'index.ts'),
      activities,
      bundlerOptions: {
        webpackConfigHook: (config) => ({
          ...config,
          resolve: {
            ...config.resolve,
            alias: {
              ...config.resolve?.alias,
              '@domain': resolve(SRC_ROOT, 'domain'),
              '@application': resolve(SRC_ROOT, 'application'),
            },
          },
        }),
      },
    }).then((worker) => worker.runUntil(fn()));

  const start = (paymentId: string) =>
    env.client.workflow.start<typeof creditCardPaymentWorkflow>(TEMPORAL.CREDIT_CARD_WORKFLOW, {
      taskQueue: TASK_QUEUE,
      workflowId: `test-${paymentId}`,
      args: [input(paymentId)],
    });

  it('creates the checkout, exposes it and settles as PAID on an approved notification', async () => {
    activities.findGatewayPayment.mockResolvedValue(null);

    const result = await runWorker(async () => {
      const handle = await start('p-approved');

      await expect(handle.executeUpdate(awaitCheckoutUpdate)).resolves.toEqual(CHECKOUT);
      await expect(handle.query(checkoutQuery)).resolves.toEqual(CHECKOUT);

      await handle.signal(gatewayPaymentSignal, {
        id: 'mp-1',
        status: GatewayPaymentStatus.APPROVED,
        statusDetail: 'accredited',
        externalReference: 'p-approved',
      });

      return handle.result();
    });

    expect(result).toEqual({
      status: 'SETTLED',
      outcome: { status: PaymentStatus.PAID, gatewayPaymentId: 'mp-1', reason: null },
    });
    expect(activities.settlePayment).toHaveBeenCalledWith({
      paymentId: 'p-approved',
      outcome: { status: PaymentStatus.PAID, gatewayPaymentId: 'mp-1', reason: null },
    });
  }, 120_000);

  it('keeps waiting on non final notifications and picks the outcome up by polling', async () => {
    activities.findGatewayPayment.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'mp-2',
      status: GatewayPaymentStatus.REJECTED,
      statusDetail: 'cc_rejected_high_risk',
      externalReference: 'p-polled',
    });

    const result = await runWorker(async () => {
      const handle = await start('p-polled');

      await handle.signal(gatewayPaymentSignal, {
        id: 'mp-2',
        status: GatewayPaymentStatus.IN_PROCESS,
        statusDetail: null,
        externalReference: 'p-polled',
      });

      return handle.result();
    });

    expect(result).toEqual({
      status: 'SETTLED',
      outcome: {
        status: PaymentStatus.FAIL,
        gatewayPaymentId: 'mp-2',
        reason: 'cc_rejected_high_risk',
      },
    });
  }, 120_000);

  it('fails the payment when the checkout expires without a confirmation', async () => {
    activities.findGatewayPayment.mockResolvedValue(null);

    const result = await runWorker(async () => (await start('p-expired')).result());

    expect(result).toEqual({
      status: 'SETTLED',
      outcome: {
        status: PaymentStatus.FAIL,
        gatewayPaymentId: null,
        reason: CHECKOUT_FAILURE_REASONS.EXPIRED,
      },
    });
  }, 120_000);

  it('stops without settling when cancelled manually', async () => {
    activities.settlePayment.mockClear();

    const result = await runWorker(async () => {
      const handle = await start('p-cancelled');

      await handle.executeUpdate(awaitCheckoutUpdate);
      await handle.signal(cancelSignal);

      return handle.result();
    });

    expect(result).toEqual({ status: 'CANCELLED' });
    expect(activities.settlePayment).not.toHaveBeenCalled();
  }, 120_000);
});
