import { Reflector } from '@nestjs/core';
import {
  ExecutionContext,
  HttpException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ChallengeCreationMode, Role } from '@prisma/client';
import { AdminChallengesController } from './admin-challenges.controller';
import { AdminChallengesService } from './admin-challenges.service';
import { ChallengeValidationService } from './challenge-validation.service';
import { ChallengeImportService } from './challenge-import.service';
import { ChallengeAiService } from './challenge-ai.service';
import { ChallengeBattlePoolService } from './battle-pool.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsertChallengeDto } from './dto/upsert-challenge.dto';

describe('AdminChallengesController', () => {
  const challenges = {
    create: jest.fn(),
    update: jest.fn(),
    publish: jest.fn(),
  } as unknown as AdminChallengesService;
  const validation = {} as ChallengeValidationService;
  const importer = new ChallengeImportService();
  const ai = { status: () => ({ configured: false }) } as unknown as ChallengeAiService;

  const pool = {} as ChallengeBattlePoolService;

  const controller = new AdminChallengesController(
    challenges,
    validation,
    importer,
    ai,
    pool,
  );

  describe('authorization', () => {
    it('requires authentication and at least ADMIN on every route', () => {
      const guards = Reflect.getMetadata('__guards__', AdminChallengesController) ?? [];
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);

      const roles = new Reflector().get(ROLES_KEY, AdminChallengesController);
      expect(roles).toEqual([Role.ADMIN]);
    });

    // RolesGuard resolves @Roles(ADMIN) through the role hierarchy, so this is
    // the behaviour the controller's metadata actually produces.
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN] as never);
    const guard = new RolesGuard(reflector);

    const contextFor = (role: Role | undefined) =>
      ({
        getHandler: () => controller.create,
        getClass: () => AdminChallengesController,
        switchToHttp: () => ({
          getRequest: () => (role ? { user: { id: 'u1', role } } : {}),
        }),
      }) as unknown as ExecutionContext;

    it('denies a plain USER', () => {
      expect(guard.canActivate(contextFor(Role.USER))).toBe(false);
    });

    it('denies an unauthenticated request', () => {
      expect(guard.canActivate(contextFor(undefined))).toBe(false);
    });

    it('allows ADMIN', () => {
      expect(guard.canActivate(contextFor(Role.ADMIN))).toBe(true);
    });

    it('allows MASTER without listing it explicitly', () => {
      expect(guard.canActivate(contextFor(Role.MASTER))).toBe(true);
    });
  });

  describe('lifecycle safety', () => {
    /** The application's real global pipe - see main.ts. */
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const metadata = {
      type: 'body' as const,
      metatype: UpsertChallengeDto,
    };

    it('strips a client-supplied status from a PATCH body', async () => {
      const result = (await pipe.transform(
        {
          title: 'Two Sum',
          status: 'PUBLISHED',
          validationStatus: 'PASSED',
          validationFingerprint: 'forged',
          publishedAt: new Date().toISOString(),
          createdById: 'someone-else',
        },
        metadata,
      )) as Record<string, unknown>;

      expect(result.title).toBe('Two Sum');
      for (const forbidden of [
        'status',
        'validationStatus',
        'validationFingerprint',
        'publishedAt',
        'createdById',
      ]) {
        expect(result).not.toHaveProperty(forbidden);
      }
    });

    /** The pipe throws BadRequestException; the detail lives in its body. */
    const rejectionMessages = async (body: unknown) => {
      try {
        await pipe.transform(body, metadata);
        throw new Error('expected the ValidationPipe to reject this body');
      } catch (error) {
        const response = (error as HttpException).getResponse?.() as {
          message?: string[];
        };
        return (response?.message ?? []).join(' ');
      }
    };

    it('rejects out-of-range execution limits before they reach the service', async () => {
      expect(await rejectionMessages({ timeLimitMs: 60_000 })).toMatch(/timeLimitMs/);
      expect(await rejectionMessages({ memoryLimitMb: 4096 })).toMatch(
        /memoryLimitMb/,
      );
      expect(await rejectionMessages({ outputLimitKb: 99_999 })).toMatch(
        /outputLimitKb/,
      );
      expect(await rejectionMessages({ timeLimitMs: 10 })).toMatch(/timeLimitMs/);
    });

    it('rejects a malformed slug', async () => {
      expect(await rejectionMessages({ slug: 'Two Sum!' })).toMatch(/slug/);
      expect(await rejectionMessages({ slug: 'Two-Sum' })).toMatch(/slug/);
    });

    it('rejects a title outside the allowed length', async () => {
      expect(await rejectionMessages({ title: 'ab' })).toMatch(/title/);
      expect(await rejectionMessages({ title: 'x'.repeat(121) })).toMatch(/title/);
    });

    it('rejects an unsupported parameter type in the contract', async () => {
      expect(
        await rejectionMessages({
          functionContract: {
            functionName: 'solve',
            parameters: [{ name: 'nums', type: 'Map<string,number>' }],
            returnType: 'number[]',
            starterCode: 'function solve(nums) {}',
          },
        }),
      ).toMatch(/type/);
    });

    it('creates an imported challenge as a JSON_IMPORT draft, never published', async () => {
      const template = importer.buildTemplate();
      (challenges.create as jest.Mock).mockResolvedValue({ challenge: {} });

      await controller.import({ user: { id: 'admin-1' } } as never, {
        content: JSON.stringify(template),
      } as never);

      const [userId, dto, mode] = (challenges.create as jest.Mock).mock.calls[0];
      expect(userId).toBe('admin-1');
      expect(mode).toBe(ChallengeCreationMode.JSON_IMPORT);
      expect(dto).not.toHaveProperty('status');
    });
  });
});

describe('AdminChallengesController routing', () => {
  it('serves GET stats from stats(), not as a challenge id', async () => {
    const stats = {
      success: true,
      stats: {
        total: 1,
        drafts: 1,
        published: 0,
        archived: 0,
        validationPassed: 0,
      },
    };
    const challenges = {
      stats: jest.fn().mockResolvedValue(stats),
      getById: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminChallengesController],
      providers: [
        { provide: AdminChallengesService, useValue: challenges },
        { provide: ChallengeValidationService, useValue: {} },
        { provide: ChallengeImportService, useValue: {} },
        { provide: ChallengeAiService, useValue: {} },
        { provide: ChallengeBattlePoolService, useValue: {} },
      ],
    })
      // Authorization is covered above; this is only about routing.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const app: INestApplication<App> = moduleRef.createNestApplication();
    await app.init();

    try {
      const res = await request(app.getHttpServer()).get(
        '/admin/challenges/stats',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(stats);
      expect(challenges.getById).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
