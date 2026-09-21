import { setTimeout as sleep } from 'node:timers/promises';
import { Logger } from '@nestjs/common';
import { NativeConnection, Worker } from '@temporalio/worker';
import { TEMPORAL } from '../temporal.const';

export interface TemporalWorkerOptions {
  address: string;
  namespace: string;
  taskQueue: string;
  activities: Record<string, (...args: never[]) => Promise<unknown>>;
}

const logger = new Logger('TemporalWorker');

const connectWithRetry = async (address: string): Promise<NativeConnection> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await NativeConnection.connect({ address });
    } catch (error) {
      if (attempt >= TEMPORAL.WORKER_CONNECT_ATTEMPTS) throw error;

      logger.warn(
        `Temporal at ${address} not reachable (attempt ${attempt}/${TEMPORAL.WORKER_CONNECT_ATTEMPTS}): ${(error as Error).message}`,
      );
      await sleep(TEMPORAL.WORKER_CONNECT_DELAY_MS);
    }
  }
};

export const createTemporalWorker = async (options: TemporalWorkerOptions): Promise<Worker> => {
  const connection = await connectWithRetry(options.address);

  return Worker.create({
    connection,
    namespace: options.namespace,
    taskQueue: options.taskQueue,
    workflowsPath: require.resolve('../workflows'),
    activities: options.activities,
  });
};
