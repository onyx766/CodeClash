import { Body, Controller, Get, Param, Post, Headers, ForbiddenException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import {
  RUNNER_SIGNATURE_HEADER,
  RUNNER_TIMESTAMP_HEADER,
  loadRunnerSecret,
  verifyRunnerSignature,
} from '../../common/security/runner-signature.util';

@Controller('jobs')
export class JobsController {
  constructor(private svc: JobsService) {}

  @Post('record')
  async record(
    @Headers(RUNNER_SIGNATURE_HEADER) signature: string,
    @Headers(RUNNER_TIMESTAMP_HEADER) timestamp: string,
    @Body() body: any,
  ) {
    const secret = loadRunnerSecret();
    if (secret) {
      if (!signature || !timestamp) throw new ForbiddenException('missing signature/timestamp');
      const valid = verifyRunnerSignature({
        secret,
        jobId: body?.jobId || '',
        timestamp,
        signature,
        body: JSON.stringify(body || {}),
      });
      if (!valid) throw new ForbiddenException('invalid signature');
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
