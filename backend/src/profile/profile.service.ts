import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { hashPassword, verifyPassword } from '../users/password';
import type { User } from '../users/user.entity';
import { ProfileErrors } from './profile.errors';

@Injectable()
export class ProfileService {
  constructor(private readonly users: UsersService) {}

  updateName(userId: string, name: string): Promise<User> {
    return this.users.rename(userId, name.trim());
  }

  /**
   * Verifies the current password before rotating it. The same error covers a
   * missing user and a bad password, though a signed-in caller should never be
   * missing — it keeps the check total.
   */
  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || !(await verifyPassword(user.passwordHash, current))) {
      throw ProfileErrors.INVALID_CURRENT_PASSWORD();
    }
    await this.users.setPasswordHash(userId, await hashPassword(next));
  }
}
