import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

/** Emails are compared case-insensitively by normalising on the way in and out. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: normaliseEmail(email) } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  /** Idempotent by email — used by the seed script, which must be rerunnable. */
  async upsertByEmail(input: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<User> {
    const email = normaliseEmail(input.email);
    const existing = await this.users.findOne({ where: { email } });

    if (existing) {
      existing.passwordHash = input.passwordHash;
      existing.name = input.name;
      return this.users.save(existing);
    }

    return this.users.save(
      this.users.create({ email, passwordHash: input.passwordHash, name: input.name }),
    );
  }

  /** Callers pass the id of the authenticated user, so existence is already
   *  guaranteed by the guard; these writes do not re-check it. */
  async rename(userId: string, name: string): Promise<User> {
    await this.users.update(userId, { name });
    return this.users.findOneOrFail({ where: { id: userId } });
  }

  async setAvatarFile(userId: string, fileId: string): Promise<User> {
    await this.users.update(userId, { avatarFileId: fileId });
    return this.users.findOneOrFail({ where: { id: userId } });
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.users.update(userId, { passwordHash });
  }
}
