import { Body, Controller, Get, Param, Post, Headers, ForbiddenException, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  RUNNER_SIGNATURE_HEADER,
  RUNNER_TIMESTAMP_HEADER,
  loadRunnerSecret,
  verifyRunnerSignature,
} from '../../common/security/runner-signature.util';

@Controller('jobs')
export class JobsController {
  constructor(private svc: JobsService) {}

  /**
   * Called by the runner worker after every job (signed with RUNNER_SECRET).
   * Exempt from rate limiting: all jobs arrive from the same worker address.
   */
  @SkipThrottle()
  @Post('record')
  async record(
    @Headers(RUNNER_SIGNATURE_HEADER) signature: string,
    @Headers(RUNNER_TIMESTAMP_HEADER) timestamp: string,
    @Body() body: any,
  ) {
    const secret = loadRunnerSecret();
    // Without a secret nothing can be verified; only tolerated in development.
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('job recording requires RUNNER_SECRET');
    }
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

  // Raw runner output and job metadata: staff only.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async recent() {
    return this.svc.recent(50);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':jobId')
  async get(@Param('jobId') jobId: string) {
    return this.svc.get(jobId);
  }
}
