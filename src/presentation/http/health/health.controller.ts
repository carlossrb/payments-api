import { PrismaService } from '@infrastructure/persistence/prisma/prisma.service';
import { RedisService } from '@infrastructure/redis/redis.service';
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

type CheckResult = 'up' | 'down';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Service, database and cache health' })
  async check(@Res({ passthrough: true }) response: Response) {
    const [database, cache] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const healthy = database === 'up';

    response.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return { status: healthy ? 'ok' : 'unavailable', checks: { database, cache } };
  }

  private async checkDatabase(): Promise<CheckResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    if (!this.redis.isReady) return 'down';

    try {
      await this.redis.client.ping();

      return 'up';
    } catch {
      return 'down';
    }
  }
}
