import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly profilesService: ProfilesService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    return this.usersService.findById(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/profile')
  async getMyProfile(@Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    return this.profilesService.getMyProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/profile')
  async updateMyProfile(@Req() req: Request, @Body() body: UpdateProfileDto) {
    const user = req.user as AuthenticatedUser;
    return this.profilesService.updateMyProfile(user.id, body);
  }

  @Get(':username/profile')
  async getPublicProfile(@Param('username') username: string) {
    return this.profilesService.getPublicProfile(username);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
