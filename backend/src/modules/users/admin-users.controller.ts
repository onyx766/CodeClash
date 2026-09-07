import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesService } from './roles.service';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUsersController {
  constructor(private readonly rolesService: RolesService) {}

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
