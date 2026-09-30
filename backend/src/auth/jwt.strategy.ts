import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import type { EnvironmentVariables } from '../config/env.validation';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { SESSION_COOKIE } from './auth.constants';
import { AuthErrors } from './auth.errors';
import type { JwtPayload } from './auth.service';

/**
 * The token lives in an httpOnly cookie, not an Authorization header — a
 * bearer extractor would never find it. Exported so it can be tested directly.
 */
export function cookieExtractor(req: Request): string | null {
  return req?.cookies?.[SESSION_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  /** Runs only after the signature and expiry already verified. */
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw AuthErrors.UNAUTHENTICATED();
    return user;
  }
}
