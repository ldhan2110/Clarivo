import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthErrors } from './auth.errors';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Throws the same error for a missing user and a bad password, so the two
   * are indistinguishable to a caller probing for valid emails.
   */
  async validate(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email);
    if (!user) throw AuthErrors.INVALID_CREDENTIALS();

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw AuthErrors.INVALID_CREDENTIALS();

    return user;
  }

  sign(user: User): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwt.signAsync(payload);
  }
}
