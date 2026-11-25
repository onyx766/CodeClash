import { Controller, Get, HttpException, Param, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import axios from 'axios';
import { RedisService } from '../../redis/redis.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('runner')
export class RunnerController {
  constructor(private config: ConfigService, private redisSvc: RedisService) {}

  private getRunnerUrl() {
    return this.config.get<string>('CODE_RUNNER_URL') || 'http://localhost:5000';
  }

  @Get('health')
  async health() {
    try {
      const url = `${this.getRunnerUrl()}/health`;
      const r = await axios.get(url, { timeout: 2000 });
      return r.data;
    } catch (e: any) {
      throw new HttpException({ ok: false, error: String(e.message || e) }, 503);
    }
  }

  @Get('ready')
  async ready() {
    try {
      const url = `${this.getRunnerUrl()}/ready`;
      const r = await axios.get(url, { timeout: 2000 });
      return r.data;
    } catch (e: any) {
      throw new HttpException({ ready: false, error: String(e.message || e) }, 503);
    }
  }

  // Queue internals and raw job output: staff only.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('status')
  async status() {
    try {
      const client = this.redisSvc.getClient();
      const queued = await client.llen('code_jobs');
      const processing = await client.llen('code_jobs:processing');
      const keys = await client.keys('runner:worker:*');
      const workers = Array.isArray(keys) ? keys.length : 0;
      return { workers, queued, processing };
    } catch (e: any) {
      throw new HttpException({ error: String(e.message || e) }, 500);
    }
  }

  // Queue internals and raw job output: staff only.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('jobs')
  async jobs() {
    try {
      const client = this.redisSvc.getClient();
      const raw = await client.lrange('code_results_index', 0, 49);
      const items = raw.map((r) => {
        try { return JSON.parse(r); } catch (e) { return { raw: r }; }
      });
      return { items };
    } catch (e: any) {
      throw new HttpException({ error: String(e.message || e) }, 500);
    }
  }

  // Queue internals and raw job output: staff only.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('job/:jobId')
  async job(@Param('jobId') jobId: string) {
    try {
      const client = this.redisSvc.getClient();
      const raw = await client.lrange(`code_results:${jobId}`, 0, -1);
      const items = raw.map((r) => {
        try { return JSON.parse(r); } catch (e) { return { raw: r }; }
      });
      if (items.length === 0) return { jobId, items: [] };
      return { jobId, items };
    } catch (e: any) {
      throw new HttpException({ error: String(e.message || e) }, 500);
    }
  }
}
