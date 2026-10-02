import * as argon2 from 'argon2';

/**
 * The one place the running app hashes a password. Seeding hashes externally
 * (src/database/seeds/seed.helpers.ts) with the same argon2id options, and
 * AuthService.validate verifies with argon2 directly — this helper deliberately
 * leaves that credential path untouched and serves only the profile
 * password-change flow.
 */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
