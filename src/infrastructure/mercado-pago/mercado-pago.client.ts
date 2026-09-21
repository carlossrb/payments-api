import { GatewayRejectedError, GatewayUnavailableError } from '@application/payment/payment.errors';
import type { EnvironmentVariables } from '@infrastructure/config/env';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MercadoPagoRequest {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  idempotencyKey?: string;
}

export interface MercadoPagoResponse<T> {
  status: number;
  data: T | null;
}

interface MercadoPagoErrorBody {
  message?: string;
  error?: string;
  cause?: unknown;
}

@Injectable()
export class MercadoPagoClient {
  private readonly logger = new Logger(MercadoPagoClient.name);
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.baseUrl = config.getOrThrow('MERCADO_PAGO_BASE_URL').replace(/\/$/, '');
    this.accessToken = config.getOrThrow('MERCADO_PAGO_ACCESS_TOKEN');
    this.timeoutMs = config.getOrThrow('MERCADO_PAGO_TIMEOUT_MS');
  }

  async request<T>(request: MercadoPagoRequest): Promise<MercadoPagoResponse<T>> {
    const url = new URL(`${this.baseUrl}${request.path}`);

    for (const [key, value] of Object.entries(request.query ?? {}))
      url.searchParams.set(key, value);

    const response = await this.send(url, request);
    const data = await this.parseBody(response);

    if (response.status === 404) return { status: 404, data: null };

    if (response.status >= 500) {
      throw new GatewayUnavailableError(`Mercado Pago responded with status ${response.status}`, {
        status: response.status,
      });
    }

    if (response.status >= 400) {
      const body = (data ?? {}) as MercadoPagoErrorBody;

      throw new GatewayRejectedError(
        body.message ?? `Mercado Pago rejected the request (${response.status})`,
        {
          status: response.status,
          error: body.error,
          cause: body.cause,
        },
      );
    }

    return { status: response.status, data: data as T };
  }

  private async send(url: URL, request: MercadoPagoRequest): Promise<Response> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.accessToken}`,
      accept: 'application/json',
    };

    if (request.body !== undefined) headers['content-type'] = 'application/json';
    if (request.idempotencyKey) headers['x-idempotency-key'] = request.idempotencyKey;

    try {
      return await fetch(url, {
        method: request.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const message = (error as Error).message;

      this.logger.warn(`Mercado Pago request ${request.method} ${url.pathname} failed: ${message}`);

      throw new GatewayUnavailableError(`Mercado Pago is unreachable: ${message}`);
    }
  }

  private async parseBody(response: Response): Promise<unknown> {
    const text = await response.text();

    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }
}
