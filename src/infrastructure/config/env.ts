import type { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  DEVELOPMENT = 'development',
  TEST = 'test',
  PRODUCTION = 'production',
}

const URL_OPTIONS = { require_tld: false, require_protocol: true };

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.DEVELOPMENT;

  @IsInt()
  @Min(1)
  APP_PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  REDIS_HOST: string = 'localhost';

  @IsInt()
  REDIS_PORT: number = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsString()
  TEMPORAL_ADDRESS: string = 'localhost:7233';

  @IsString()
  TEMPORAL_NAMESPACE: string = 'default';

  @IsString()
  TEMPORAL_TASK_QUEUE: string = 'payments';

  @IsUrl(URL_OPTIONS)
  MERCADO_PAGO_BASE_URL: string = 'https://api.mercadopago.com';

  @IsString()
  @IsNotEmpty()
  MERCADO_PAGO_ACCESS_TOKEN!: string;

  @IsString()
  @IsNotEmpty()
  MERCADO_PAGO_WEBHOOK_SECRET!: string;

  @IsUrl(URL_OPTIONS)
  MERCADO_PAGO_NOTIFICATION_URL!: string;

  @IsInt()
  @Min(100)
  MERCADO_PAGO_TIMEOUT_MS: number = 5000;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  CHECKOUT_BACK_URL?: string;

  @IsInt()
  @Min(1)
  CHECKOUT_TTL_MINUTES: number = 1440;

  @IsInt()
  @Min(5)
  CHECKOUT_POLL_INTERVAL_SECONDS: number = 300;
}

export type AppConfig = ConfigService<EnvironmentVariables, true>;

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length === 0) return validated;

  const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));

  throw new Error(`Invalid environment configuration: ${messages.join('; ')}`);
}
