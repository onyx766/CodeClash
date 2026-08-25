import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class RoundsService {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  private getRunnerUrl() {
    return this.config.get<string>('CODE_RUNNER_URL') || 'http://localhost:5000';
  }

  async runCode(userId: string, roundId: string, code: string) {
    const round = await this.prisma.round.findUnique({ where: { id: roundId }, include: { challenge: { include: { testCases: true } }, match: true } });
    if (!round) throw new BadRequestException('Round not found');
    const publicTests = round.challenge.testCases.filter((t) => !t.isHidden).map((t) => ({ input: t.input, expectedOutput: t.expectedOutput }));
    const res = await axios.post(`${this.getRunnerUrl()}/run`, { code, testCases: publicTests, functionName: round.challenge.functionName, timeLimitSeconds: round.challenge.timeLimitSeconds, metadata: { userId, roundId, matchId: round.matchId } });
    return res.data;
  }

  async submitCode(userId: string, roundId: string, code: string) {
    const round = await this.prisma.round.findUnique({ where: { id: roundId }, include: { challenge: { include: { testCases: true } }, match: true } });
    if (!round) throw new BadRequestException('Round not found');
    const allTests = round.challenge.testCases.map((t) => ({ input: t.input, expectedOutput: t.expectedOutput }));
    const res = await axios.post(`${this.getRunnerUrl()}/run`, { code, testCases: allTests, functionName: round.challenge.functionName, timeLimitSeconds: round.challenge.timeLimitSeconds, metadata: { userId, roundId, matchId: round.matchId } });
    const { passedTests, totalTests, runtimeMs } = res.data;

    // scoring: correctness portion only for MVP
    const correctness = Math.round((passedTests / Math.max(1, totalTests)) * 700);
    const score = correctness; // bonuses to be added later

    const submission = await this.prisma.submission.create({ data: { userId, roundId, code, passedTests, totalTests, runtimeMs: Math.round(runtimeMs || 0), score } });

    return { submission, results: res.data };
  }
}
