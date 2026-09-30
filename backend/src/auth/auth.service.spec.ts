import { describe, expect, it, vi } from 'vitest';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

const jwt = { signAsync: vi.fn().mockResolvedValue('signed.jwt.token') };

describe('AuthService.validate', () => {
  it('rejects an unknown email and a wrong password with the identical error', async () => {
    const hash = await argon2.hash('correct-password', { type: argon2.argon2id });
    const user = { id: 'u1', email: 'a@b.c', passwordHash: hash, name: 'A' };

    const unknown = new AuthService({ findByEmail: async () => null } as never, jwt as never);
    const wrongPw = new AuthService({ findByEmail: async () => user } as never, jwt as never);

    const e1 = await unknown.validate('nobody@b.c', 'whatever').catch((e) => e);
    const e2 = await wrongPw.validate('a@b.c', 'wrong-password').catch((e) => e);

    // Same code, same message, same status — no account-existence oracle.
    expect(e1.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(e2.code).toBe(e1.code);
    expect(e2.message).toBe(e1.message);
    expect(e2.getStatus()).toBe(e1.getStatus());
  });

  it('returns the user for a correct password', async () => {
    const hash = await argon2.hash('correct-password', { type: argon2.argon2id });
    const user = { id: 'u1', email: 'a@b.c', passwordHash: hash, name: 'A' };
    const service = new AuthService({ findByEmail: async () => user } as never, jwt as never);

    await expect(service.validate('a@b.c', 'correct-password')).resolves.toBe(user);
  });
});

describe('AuthService.sign', () => {
  it('puts only the id and email in the payload', async () => {
    const service = new AuthService({} as never, jwt as never);
    await service.sign({ id: 'u1', email: 'a@b.c', name: 'A', passwordHash: 'h' } as never);

    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1', email: 'a@b.c' });
  });
});
