import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ChallengesService {
  constructor(private prisma: PrismaService) {}

  async findAll(pickHidden = false) {
    const challenges = await this.prisma.challenge.findMany({
      include: { testCases: true },
    });
    if (pickHidden) return challenges;
    return challenges.map((c) => ({
      ...c,
      testCases: c.testCases.filter((t) => !t.isHidden).map((t) => ({ id: t.id, input: t.input })),
    }));
  }

  async findById(id: string, includeHidden = false) {
    const c = await this.prisma.challenge.findUnique({ where: { id }, include: { testCases: true } });
    if (!c) return null;
    if (includeHidden) return c;
    return { ...c, testCases: c.testCases.filter((t) => !t.isHidden).map((t) => ({ id: t.id, input: t.input })) };
  }

  async adminCreate(data: any) {
    const { testCases = [], ...rest } = data;
    const challenge = await this.prisma.challenge.create({ data: { ...rest } });
    for (const tc of testCases) {
      await this.prisma.challengeTestCase.create({ data: { challengeId: challenge.id, ...tc } });
    }
    return this.findById(challenge.id, true);
  }

  async adminUpdate(id: string, data: any) {
    const { testCases, ...rest } = data;
    await this.prisma.challenge.update({ where: { id }, data: { ...rest } });
    if (testCases) {
      // naive: delete existing and recreate
      await this.prisma.challengeTestCase.deleteMany({ where: { challengeId: id } });
      for (const tc of testCases) {
        await this.prisma.challengeTestCase.create({ data: { challengeId: id, ...tc } });
      }
    }
    return this.findById(id, true);
  }

  async adminDelete(id: string) {
    await this.prisma.challengeTestCase.deleteMany({ where: { challengeId: id } });
    await this.prisma.challenge.delete({ where: { id } });
    return { success: true };
  }
}
