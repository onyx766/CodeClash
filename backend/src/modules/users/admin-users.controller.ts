import {
  Body,
  Controller,
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
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesService } from './roles.service';
import { AdminUsersService } from './admin-users.service';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { BanUserDto, CreateUserDto } from './dto/moderate-user.dto';
import {
  AdminResetPasswordDto,
  AdminUpdateUserDto,
} from './dto/admin-update-user.dto';
import { AuthenticatedUser } from '../auth/auth.types';

/**
 * User management API for the admin console.
 *
 * Reading and banning require ADMIN; changing a role remains MASTER-only. The
 * per-target rules (you cannot moderate yourself, and only accounts you
 * strictly outrank) live in AdminUsersService, because RolesGuard only knows
 * about the caller, never the target.
 */
@ApiTags('admin-users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUsersController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly adminUsers: AdminUsersService,
  ) {}

  @Roles(Role.ADMIN)
  @Get()
  list(@Query() query: ListUsersDto) {
    return this.adminUsers.list(query);
  }

  @Roles(Role.ADMIN)
  @Get('stats')
  stats() {
    return this.adminUsers.stats();
  }

  @Roles(Role.ADMIN)
  @Get(':userId')
  async getOne(@Param('userId', ParseUUIDPipe) userId: string) {
    return { user: await this.adminUsers.getDetail(userId) };
  }

  /** Account + profile details. Role and ban status have their own routes. */
  @Roles(Role.ADMIN)
  @Patch(':userId')
  async update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AdminUpdateUserDto,
    @Req() req: Request,
  ) {
    const actor = req.user as AuthenticatedUser;
    return this.adminUsers.update(actor, userId, dto);
  }

  /** Sets a new password and signs the account out everywhere. */
  @Roles(Role.ADMIN)
  @Post(':userId/password')
  async resetPassword(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AdminResetPasswordDto,
    @Req() req: Request,
  ) {
    const actor = req.user as AuthenticatedUser;
    return this.adminUsers.resetPassword(actor, userId, dto);
  }

  @Roles(Role.ADMIN)
  @Post()
  async create(@Req() req: Request, @Body() dto: CreateUserDto) {
    const actor = req.user as AuthenticatedUser;
    return this.adminUsers.create(actor, dto);
  }

  @Roles(Role.ADMIN)
  @Post(':userId/ban')
  async ban(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: BanUserDto,
    @Req() req: Request,
  ) {
    const actor = req.user as AuthenticatedUser;
    return this.adminUsers.ban(actor, userId, dto);
  }

  @Roles(Role.ADMIN)
  @Post(':userId/unban')
  async unban(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: Request,
  ) {
    const actor = req.user as AuthenticatedUser;
    return this.adminUsers.unban(actor, userId);
  }

  @Roles(Role.MASTER)
  @Patch(':userId/role')
  async updateRole(
    @Param('userId') userId: string,
    @Body() body: UpdateRoleDto,
    @Req() req: Request,
  ) {
    const actor = req.user as AuthenticatedUser;
    const user = await this.rolesService.changeRole(actor.role, userId, body.role);
    return { success: true, user };
  }
}
