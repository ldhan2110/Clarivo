import * as argon2 from 'argon2';
import type { Repository } from 'typeorm';
import type { EnvironmentVariables } from '../../config/env.validation';
import type { User } from '../../users/user.entity';
import { normaliseEmail } from '../../users/users.service';

export interface SeedAccount {
  email: string;
  password: string;
  name: string;
}

/** Idempotent by normalised email — a rerun updates rather than duplicating. */
export async function upsertAccount(
  users: Repository<User>,
  input: SeedAccount,
): Promise<'created' | 'updated'> {
  const email = normaliseEmail(input.email);
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

  const existing = await users.findOne({ where: { email } });
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.name = input.name;
    await users.save(existing);
    return 'updated';
  }

  await users.save(users.create({ email, passwordHash, name: input.name }));
  return 'created';
}

/**
 * All three or nothing. A half-configured fixture would otherwise seed an
 * account with an empty password or no name — the vars are @IsOptional() so
 * that an existing .env stays valid, which means the guard lives here.
 */
export function memberAccount(env: EnvironmentVariables): SeedAccount | null {
  if (!env.SEED_MEMBER_EMAIL || !env.SEED_MEMBER_PASSWORD || !env.SEED_MEMBER_NAME) return null;
  return {
    email: env.SEED_MEMBER_EMAIL,
    password: env.SEED_MEMBER_PASSWORD,
    name: env.SEED_MEMBER_NAME,
  };
}
