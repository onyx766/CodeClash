import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async recordJob(jobId: string, metadata: any, exitCode: number | null, payload: any) {
    // upsert Job
    const job = await this.prisma.job.upsert({
      where: { id: jobId },
      update: { status: exitCode === 0 ? 'COMPLETED' : 'FAILED', exitCode },
      create: { id: jobId, metadata: metadata || null, status: exitCode === 0 ? 'COMPLETED' : 'FAILED', exitCode },
    });
    await this.prisma.jobResult.create({ data: { jobId: job.id, payload } });
    return job;
  }

  async recent(limit = 50) {
    return this.prisma.job.findMany({ include: { results: true }, orderBy: { createdAt: 'desc' }, take: limit });
  }

  async get(jobId: string) {
    return this.prisma.job.findUnique({ where: { id: jobId }, include: { results: true } });
  }
}
