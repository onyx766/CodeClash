import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RoomsService } from '../rooms/rooms.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  setAuthCookies,
  clearAuthCookies,
} from '../../common/security/cookie.util';
import { getClientIp } from '../../common/utils/client-ip.util';
import { REFRESH_TOKEN_COOKIE } from '../../common/constants/auth.constants';
import { UnauthenticatedException } from '../../common/exceptions/app.exception';
import { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly roomsService: RoomsService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.register(
      body.email,
      body.username,
      body.password,
      getClientIp(req),
    );
    setAuthCookies(res, tokens, this.config);
    return { success: true, user };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.login(
      body.email,
      body.password,
      getClientIp(req),
    );
    setAuthCookies(res, tokens, this.config);
    const activeRoom = await this.roomsService.findActiveRoomForUser(user.id);
    return {
      success: true,
      user,
      activeRoom: activeRoom ? { id: activeRoom.id, code: activeRoom.code } : null,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      throw new UnauthenticatedException('Missing refresh token');
    }

    const { user, tokens } = await this.authService.refresh(refreshToken);
    setAuthCookies(res, tokens, this.config);
    return { success: true, user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookies(res, this.config);
    return { success: true };
  }

  /**
   * Changes the caller's password, signs out their other sessions and
   * re-issues this session's cookies.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() req: Request,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as AuthenticatedUser;
    const { tokens } = await this.authService.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
    setAuthCookies(res, tokens, this.config);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    const activeRoom = await this.roomsService.findActiveRoomForUser(user.id);
    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        // The caller's own role. Included so a client (notably the admin
        // console) can render the right shell without guessing - it is never
        // what authorises anything: RolesGuard re-reads the role from the JWT
        // identity on every protected request.
        role: user.role,
        createdAt: user.createdAt,
      },
      activeRoom: activeRoom ? { id: activeRoom.id, code: activeRoom.code } : null,
    };
  }
}
