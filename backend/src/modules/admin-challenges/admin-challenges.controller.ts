import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChallengeCreationMode, ChallengeStatus, Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminChallengesService } from './admin-challenges.service';
import { ChallengeValidationService } from './challenge-validation.service';
import { ChallengeImportService } from './challenge-import.service';
import { ChallengeAiService } from './challenge-ai.service';
import { ChallengeBattlePoolService } from './battle-pool.service';
import { UpsertChallengeDto } from './dto/upsert-challenge.dto';
import { ImportChallengeDto } from './dto/import-challenge.dto';
import { AiGenerateChallengeDto } from './dto/ai-generate.dto';

/**
 * Challenge authoring API.
 *
 * Every route requires an authenticated session and at least ADMIN. RolesGuard
 * resolves the role from the database-backed JWT identity via the role
 * hierarchy (USER < ADMIN < MASTER), so MASTER is allowed without being listed
 * and a `{"role":"ADMIN"}` field in a request body means nothing.
 */
@ApiTags('admin-challenges')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/challenges')
export class AdminChallengesController {
  constructor(
    private readonly challenges: AdminChallengesService,
    private readonly validation: ChallengeValidationService,
    private readonly importer: ChallengeImportService,
    private readonly ai: ChallengeAiService,
    private readonly pool: ChallengeBattlePoolService,
  ) {}

  @Get()
  list(
    @Query('status') status?: ChallengeStatus,
    @Query('search') search?: string,
  ) {
    const parsed =
      status && Object.values(ChallengeStatus).includes(status)
        ? status
        : undefined;
    return this.challenges.list(parsed, search?.slice(0, 120));
  }

  /**
   * Overview counts (total, by status, validation passed), counted in the
   * database rather than from list()'s capped page. Declared before ':id' so
   * the literal path wins.
   */
  @Get('stats')
  stats() {
    return this.challenges.stats();
  }

  /** Downloadable starting point for the Import JSON mode. */
  @Get('import/template')
  template() {
    return { template: this.importer.buildTemplate() };
  }

  /** Lets the admin UI disable the Generate button instead of failing on click. */
  @Get('ai/status')
  aiStatus() {
    return this.ai.status();
  }

  /**
   * Which challenges battles can draw from, why the rest are excluded, and
   * whether the code runner is reachable. Declared before ':id' so the
   * literal path wins.
   */
  @Get('battle-pool')
  battlePool() {
    return this.pool.overview();
  }

  /** Runs validation for every published challenge that has not passed. */
  @Post('validate-published')
  validatePublished() {
    return this.pool.validatePublished();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.challenges.getById(id);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: UpsertChallengeDto) {
    return this.challenges.create(
      req.user!.id,
      dto,
      ChallengeCreationMode.MANUAL,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertChallengeDto,
  ) {
    // `status` is not part of UpsertChallengeDto and the global ValidationPipe
    // whitelists, so PATCH can never move a challenge to PUBLISHED. That is
    // what POST :id/publish is for.
    return this.challenges.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.challenges.remove(id);
  }

  @Post(':id/validate')
  validate(@Param('id', ParseUUIDPipe) id: string) {
    return this.validation.validate(id);
  }

  @Post(':id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.challenges.publish(id);
  }

  @Post(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.challenges.archive(id);
  }

  /**
   * Imports a challenge document as a DRAFT. Never publishes: the admin reviews
   * the populated editor and runs validation like any other draft.
   */
  @Post('import')
  async import(@Req() req: Request, @Body() dto: ImportChallengeDto) {
    const parsed = this.importer.parse(dto);
    return this.challenges.create(
      req.user!.id,
      parsed,
      ChallengeCreationMode.JSON_IMPORT,
    );
  }

  /**
   * Returns a draft-compatible structure. It is deliberately NOT persisted: the
   * admin reviews it in the editor and saves it themselves, so nothing an AI
   * produced reaches the database unreviewed.
   */
  @Post('ai/generate')
  async generate(@Body() dto: AiGenerateChallengeDto) {
    const draft = await this.ai.generate(dto);
    return { draft, creationMode: ChallengeCreationMode.AI };
  }

  /** Persists a reviewed AI draft. Still a DRAFT, still needs validation. */
  @Post('ai/save')
  async saveGenerated(@Req() req: Request, @Body() dto: UpsertChallengeDto) {
    return this.challenges.create(req.user!.id, dto, ChallengeCreationMode.AI);
  }
}
