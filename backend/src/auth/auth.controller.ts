import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import type { CookieOptions, Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import { NodeEnv } from '../config/env.validation';
import type { User } from '../users/user.entity';
import { UserDto } from '../users/dto/user.dto';
import { REMEMBER_ME_MAX_AGE_MS, SESSION_COOKIE } from './auth.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

function toUserDto(user: User): UserDto {
  return plainToInstance(UserDto, user, { excludeExtraneousValues: true });
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** Same-site in dev (localhost:3000 vs :3001 share a site), so Lax is enough. */
  private cookieOptions(remember: boolean): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: this.config.get('NODE_ENV', { infer: true }) === NodeEnv.Production,
      // Omitted entirely when not remembering — that is what makes it a session cookie.
      ...(remember ? { maxAge: REMEMBER_ME_MAX_AGE_MS } : {}),
    };
  }

  /** Sign in with email and password. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserDto> {
    const user = await this.auth.validate(dto.email, dto.password);
    const token = await this.auth.sign(user);

    res.cookie(SESSION_COOKIE, token, this.cookieOptions(dto.remember));
    return toUserDto(user);
  }

  /** Clear the session cookie. */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { success: true };
  }

  /** The signed-in user, identified from the session cookie. */
  @Get('me')
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request): UserDto {
    return toUserDto(req.user as User);
  }
}
