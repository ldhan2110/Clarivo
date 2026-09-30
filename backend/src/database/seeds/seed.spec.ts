import * as argon2 from 'argon2';
import { describe, expect, it } from 'vitest';
import { normaliseEmail } from '../../users/users.service';

/**
 * The seed script itself opens a DataSource, so it is exercised end-to-end by
 * `pnpm seed`. What is unit-testable here is the contract it relies on: the
 * hash it stores must verify, and the email it keys the upsert on must be
 * normalised the same way UsersService normalises it on lookup.
 */
describe('seed contract', () => {
  it('produces an argon2id hash that verifies against the original password', async () => {
    const hash = await argon2.hash('a-throwaway-test-password', { type: argon2.argon2id });

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash.length).toBeLessThanOrEqual(255); // fits varchar(255)
    await expect(argon2.verify(hash, 'a-throwaway-test-password')).resolves.toBe(true);
    await expect(argon2.verify(hash, 'wrong')).resolves.toBe(false);
  });

  it('keys the upsert on the same normalised email the login lookup uses', () => {
    expect(normaliseEmail('Admin@Clarivo.Local')).toBe(normaliseEmail('admin@clarivo.local'));
  });
});
