import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Difficulty } from '@prisma/client';
import { ChallengeAiService } from './challenge-ai.service';
import { ChallengeImportService } from './challenge-import.service';
import {
  AiGenerationFailedException,
  AiGenerationUnavailableException,
} from '../../common/exceptions/app.exception';
import type { AiGenerateChallengeDto } from './dto/ai-generate.dto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const REQUEST: AiGenerateChallengeDto = {
  topic: 'Arrays / Hash Maps',
  difficulty: Difficulty.MEDIUM,
  instructions: 'Test Map usage without being identical to Two Sum.',
};

function buildService(env: Record<string, string | undefined>) {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  return new ChallengeAiService(config, new ChallengeImportService());
}

describe('ChallengeAiService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('when no provider is configured', () => {
    const service = buildService({});

    it('reports itself unavailable', () => {
      expect(service.isConfigured()).toBe(false);
      expect(service.status()).toMatchObject({ configured: false });
    });

    it('refuses to generate rather than fabricating a challenge', async () => {
      await expect(service.generate(REQUEST)).rejects.toBeInstanceOf(
        AiGenerationUnavailableException,
      );
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('when a provider is configured', () => {
    const service = buildService({ AI_SERVICE_URL: 'https://ai.example/generate' });

    it('validates the provider response through the same importer as a JSON upload', async () => {
      const document = new ChallengeImportService().buildTemplate();
      mockedAxios.post.mockResolvedValue({ data: document } as never);

      const draft = await service.generate(REQUEST);

      expect(draft.title).toBe('Two Sum');
      expect(draft.functionContract?.functionName).toBe('solve');
      // Nothing the provider sends can set a lifecycle field.
      expect(draft).not.toHaveProperty('status');
      expect(draft).not.toHaveProperty('validationStatus');
    });

    it('accepts a response wrapped in { challenge }', async () => {
      const document = new ChallengeImportService().buildTemplate();
      mockedAxios.post.mockResolvedValue({ data: { challenge: document } } as never);

      await expect(service.generate(REQUEST)).resolves.toMatchObject({
        title: 'Two Sum',
      });
    });

    it('rejects a response that does not satisfy the challenge schema', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { title: 'Nope', description: 'missing everything else' },
      } as never);

      await expect(service.generate(REQUEST)).rejects.toBeInstanceOf(
        AiGenerationFailedException,
      );
    });

    it('rejects a response carrying prototype-pollution keys', async () => {
      const document = new ChallengeImportService().buildTemplate();
      mockedAxios.post.mockResolvedValue({
        data: {
          ...document,
          tests: [{ input: JSON.parse('{"__proto__":{"x":1}}'), expectedOutput: 1 }],
        },
      } as never);

      await expect(service.generate(REQUEST)).rejects.toBeInstanceOf(
        AiGenerationFailedException,
      );
    });

    it('surfaces a provider failure instead of inventing output', async () => {
      mockedAxios.post.mockRejectedValue(new Error('502 Bad Gateway'));

      await expect(service.generate(REQUEST)).rejects.toBeInstanceOf(
        AiGenerationFailedException,
      );
    });
  });
});
