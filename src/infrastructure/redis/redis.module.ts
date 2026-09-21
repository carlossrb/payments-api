import { CACHE } from '@application/shared/ports/cache';
import { DISTRIBUTED_LOCK } from '@application/shared/ports/distributed-lock';
import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisCache } from './redis-cache';
import { RedisLock } from './redis-lock';

@Module({
  providers: [
    RedisService,
    { provide: CACHE, useClass: RedisCache },
    { provide: DISTRIBUTED_LOCK, useClass: RedisLock },
  ],
  exports: [RedisService, CACHE, DISTRIBUTED_LOCK],
})
export class RedisModule {}
