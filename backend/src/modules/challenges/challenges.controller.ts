import { Body, Controller, Get, Param, Post, UseGuards, Patch, Delete } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('challenges')
export class ChallengesController {
  constructor(private svc: ChallengesService) {}

  @Get()
  async list() {
    return this.svc.findAll(false);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.svc.findById(id, false);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('/admin/all')
  async adminList() {
    return this.svc.findAll(true);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('/admin')
  async create(@Body() body: CreateChallengeDto) {
    return this.svc.adminCreate(body as any);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('/admin/:id')
  async update(@Param('id') id: string, @Body() body: UpdateChallengeDto) {
    return this.svc.adminUpdate(id, body as any);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('/admin/:id')
  async del(@Param('id') id: string) {
    return this.svc.adminDelete(id);
  }
}
