import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  AiGenerationFailedException,
  AiGenerationUnavailableException,
} from '../../common/exceptions/app.exception';
import type { AiGenerateChallengeDto } from './dto/ai-generate.dto';
import type { UpsertChallengeDto } from './dto/upsert-challenge.dto';
import { ChallengeImportService } from './challenge-import.service';

/**
 * AI-assisted draft generation.
 *
 * The provider is treated as an untrusted source of *draft content*: whatever
 * comes back is pushed through exactly the same document parser the JSON
 * importer uses, so it is size-capped, whitelist-mapped and schema-checked
 * before it can become a row. The AI never publishes, never sets a role, never
 * writes to the database directly and never executes anything - the resulting
 * draft still has to pass runner validation like any other.
 *
 * When no provider is configured the feature reports itself unavailable rather
 * than inventing a challenge.
 */
@Injectable()
export class ChallengeAiService {
  private readonly logger = new Logger(ChallengeAiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly importer: ChallengeImportService,
  ) {}

  private get endpoint(): string | undefined {
    return this.config.get<string>('AI_SERVICE_URL')?.trim() || undefined;
  }

  private get apiKey(): string | undefined {
    return this.config.get<string>('AI_SERVICE_API_KEY')?.trim() || undefined;
  }

  isConfigured(): boolean {
    return !!this.endpoint;
  }

  status() {
    return {
      configured: this.isConfigured(),
      message: this.isConfigured()
        ? 'AI generation is available.'
        : 'AI generation is not configured. Set AI_SERVICE_URL to enable it.',
    };
  }

  /**
   * Asks the configured AI service for a challenge document and returns it as a
   * draft-compatible DTO. Throws AI_GENERATION_UNAVAILABLE when the feature is
   * switched off - it never fabricates output.
   */
  async generate(dto: AiGenerateChallengeDto): Promise<UpsertChallengeDto> {
    const endpoint = this.endpoint;
    if (!endpoint) {
      throw new AiGenerationUnavailableException(
        'AI generation is not configured. Set AI_SERVICE_URL to enable it.',
      );
    }

    const timeoutMs =
      this.config.get<number>('AI_SERVICE_TIMEOUT_MS') ?? 60_000;

    let document: unknown;
    try {
      const response = await axios.post<unknown>(
        endpoint,
        {
          topic: dto.topic,
          difficulty: dto.difficulty,
          tags: dto.tags ?? [],
          concept: dto.concept ?? null,
          publicTestCount: dto.publicTestCount ?? 3,
          hiddenTestCount: dto.hiddenTestCount ?? 5,
          instructions: dto.instructions ?? null,
          // The provider is told the exact document shape we will accept; we
          // still re-validate everything it sends back.
          format: this.importer.buildTemplate(),
        },
        {
          timeout: timeoutMs,
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        },
      );
      document = response.data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI generation request failed: ${message}`);
      throw new AiGenerationFailedException(
        `The AI service did not return a challenge (${message}).`,
      );
    }

    // Some providers wrap the payload; accept either shape, then validate.
    const candidate =
      document && typeof document === 'object' && 'challenge' in document
        ? (document as { challenge: unknown }).challenge
        : document;

    try {
      return this.importer.parse({ content: JSON.stringify(candidate) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AiGenerationFailedException(
        `The AI service returned a challenge that failed validation: ${message}`,
      );
    }
  }
}
