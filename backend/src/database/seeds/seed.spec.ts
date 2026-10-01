import * as argon2 from 'argon2';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/env.validation';
import { User } from '../../users/user.entity';
import { normaliseEmail } from '../../users/users.service';
import { memberAccount, upsertAccount } from './seed.helpers';

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

/** Minimal in-memory stand-in for Repository<User>. */
function fakeUsers() {
  const rows: User[] = [];
  return {
    rows,
    create: (input: Partial<User>) => Object.assign(new User(), input),
    findOne: async ({ where }: { where: { email: string } }) =>
      rows.find((u) => u.email === where.email) ?? null,
    save: vi.fn(async (user: User) => {
      if (!rows.includes(user)) rows.push(user);
      return user;
    }),
  };
}

function env(over: Partial<EnvironmentVariables> = {}): EnvironmentVariables {
  return over as EnvironmentVariables;
}

describe('the optional second account', () => {
  it('is seeded when all three vars are set', () => {
    expect(
      memberAccount(
        env({
          SEED_MEMBER_EMAIL: 'member@clarivo.local',
          SEED_MEMBER_PASSWORD: 'secret',
          SEED_MEMBER_NAME: 'Mia Member',
        }),
      ),
    ).toEqual({ email: 'member@clarivo.local', password: 'secret', name: 'Mia Member' });
  });

  // Half-configured must skip rather than seed an account with no password:
  // the vars are @IsOptional() so an existing .env stays valid, which puts the
  // all-or-nothing decision here.
  it('is skipped when any one of them is unset', () => {
    expect(memberAccount(env())).toBeNull();
    expect(
      memberAccount(env({ SEED_MEMBER_EMAIL: 'member@clarivo.local' })),
    ).toBeNull();
    expect(
      memberAccount(
        env({ SEED_MEMBER_EMAIL: 'member@clarivo.local', SEED_MEMBER_PASSWORD: 'secret' }),
      ),
    ).toBeNull();
    expect(
      memberAccount(
        env({
          SEED_MEMBER_EMAIL: 'member@clarivo.local',
          SEED_MEMBER_PASSWORD: 'secret',
          SEED_MEMBER_NAME: '',
        }),
      ),
    ).toBeNull();
  });

  it('upserts idempotently, by normalised email', async () => {
    const users = fakeUsers();
    const account = { email: 'Member@Clarivo.Local', password: 'secret', name: 'Mia Member' };

    expect(await upsertAccount(users as never, account)).toBe('created');
    expect(await upsertAccount(users as never, account)).toBe('updated');
    expect(await upsertAccount(users as never, { ...account, email: 'member@clarivo.local' })).toBe(
      'updated',
    );

    expect(users.rows).toHaveLength(1);
    expect(users.rows[0].email).toBe('member@clarivo.local');
    await expect(argon2.verify(users.rows[0].passwordHash, 'secret')).resolves.toBe(true);
  });

  it('leaves the admin upsert on exactly the same path', async () => {
    const users = fakeUsers();
    expect(
      await upsertAccount(users as never, {
        email: 'admin@clarivo.local',
        password: 'secret',
        name: 'An Le',
      }),
    ).toBe('created');
    expect(users.rows).toHaveLength(1);
  });
});
