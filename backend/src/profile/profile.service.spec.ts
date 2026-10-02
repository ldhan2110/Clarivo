import { describe, expect, it, vi } from 'vitest';
import * as argon2 from 'argon2';
import { ProfileService } from './profile.service';

describe('ProfileService.changePassword', () => {
  it('rotates the hash when the current password is correct', async () => {
    const hash = await argon2.hash('current-pw', { type: argon2.argon2id });
    const setPasswordHash = vi.fn().mockResolvedValue(undefined);
    const users = {
      findById: async () => ({ id: 'u1', passwordHash: hash }),
      setPasswordHash,
    };
    const service = new ProfileService(users as never);

    await service.changePassword('u1', 'current-pw', 'brand-new-pw');

    expect(setPasswordHash).toHaveBeenCalledOnce();
    const [, newHash] = setPasswordHash.mock.calls[0];
    // The stored value is a fresh hash of the NEW password, not the old one.
    await expect(argon2.verify(newHash, 'brand-new-pw')).resolves.toBe(true);
    await expect(argon2.verify(newHash, 'current-pw')).resolves.toBe(false);
  });

  it('throws PROFILE_INVALID_CURRENT_PASSWORD and writes nothing on a wrong current password', async () => {
    const hash = await argon2.hash('current-pw', { type: argon2.argon2id });
    const setPasswordHash = vi.fn();
    const users = {
      findById: async () => ({ id: 'u1', passwordHash: hash }),
      setPasswordHash,
    };
    const service = new ProfileService(users as never);

    const err = await service.changePassword('u1', 'wrong-pw', 'brand-new-pw').catch((e) => e);

    expect(err.code).toBe('PROFILE_INVALID_CURRENT_PASSWORD');
    expect(err.getStatus()).toBe(401);
    expect(setPasswordHash).not.toHaveBeenCalled();
  });
});

describe('ProfileService.updateName', () => {
  it('trims the name before saving', async () => {
    const rename = vi.fn().mockResolvedValue({ id: 'u1', name: 'An Le' });
    const service = new ProfileService({ rename } as never);

    await service.updateName('u1', '  An Le  ');

    expect(rename).toHaveBeenCalledWith('u1', 'An Le');
  });
});
