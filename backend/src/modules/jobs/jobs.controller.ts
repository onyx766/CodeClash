import { Body, Controller, Get, Param, Post, Headers, ForbiddenException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { createHmac, timingSafeEqual } from 'crypto';
import fs from 'fs';

@Controller('jobs')
export class JobsController {
  constructor(private svc: JobsService) {}

  @Post('record')
  async record(
    @Headers('x-runner-signature') signature: string,
    @Headers('x-runner-timestamp') timestamp: string,
    @Body() body: any,
  ) {
    const secret = process.env.RUNNER_SECRET || (() => {
      try { return fs.readFileSync('/run/secrets/runner_secret', 'utf8').trim(); } catch (e) { return undefined; }
    })();
    if (secret) {
      if (!signature || !timestamp) throw new ForbiddenException('missing signature/timestamp');
      const ts = Number(timestamp);
      if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > 60_000) {
        throw new ForbiddenException('stale timestamp');
      }
      const bodyStr = JSON.stringify(body || {});
      const expected = createHmac('sha256', secret).update(`${body.jobId || ''}.${timestamp}.${bodyStr}`).digest('hex');
      try {
        const a = Buffer.from(expected, 'hex');
        const b = Buffer.from(signature, 'hex');
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          throw new ForbiddenException('invalid signature');
        }
      } catch (e) {
        throw new ForbiddenException('invalid signature');
      }
    }
    const { jobId, metadata, exitCode, payload } = body;
    if (!jobId) return { error: 'missing jobId' };
    const job = await this.svc.recordJob(jobId, metadata, typeof exitCode === 'number' ? exitCode : null, payload || {});
    return { ok: true, job };
  }

  @Get()
  async recent() {
    return this.svc.recent(50);
  }

  @Get(':jobId')
  async get(@Param('jobId') jobId: string) {
    return this.svc.get(jobId);
  }
}
