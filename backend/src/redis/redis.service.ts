import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private config: ConfigService) {
    const host = this.config.get('REDIS_HOST') || 'localhost';
    const port = Number(this.config.get('REDIS_PORT') || 6379);
    this.client = new Redis({ host, port });
  }

  onModuleInit() {
    // noop
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  getClient() {
    return this.client;
  }
}
