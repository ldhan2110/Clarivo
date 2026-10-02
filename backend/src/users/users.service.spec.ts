import { describe, expect, it, vi } from 'vitest';
import { UsersService, normaliseEmail } from './users.service';

describe('normaliseEmail', () => {
  it('lowercases and trims', () => {
    expect(normaliseEmail('  An.LE@Clarivo.Local ')).toBe('an.le@clarivo.local');
  });
});

describe('UsersService', () => {
  it('lowercases the email before querying', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const service = new UsersService({ findOne } as never);

    await service.findByEmail('An.LE@Clarivo.Local');

    expect(findOne).toHaveBeenCalledWith({ where: { email: 'an.le@clarivo.local' } });
  });

  it('updates in place rather than inserting a second row for the same email', async () => {
    const existing = { id: 'u1', email: 'a@b.c', passwordHash: 'old', name: 'Old' };
    const save = vi.fn().mockImplementation((u) => Promise.resolve(u));
    const create = vi.fn();
    const findOne = vi.fn().mockResolvedValue(existing);
    const service = new UsersService({ findOne, save, create } as never);

    const result = await service.upsertByEmail({
      email: 'A@B.C',
      passwordHash: 'new',
      name: 'New',
    });

    expect(create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'u1', passwordHash: 'new', name: 'New' });
  });

  it('rename updates the name and returns the reloaded user', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const findOneOrFail = vi.fn().mockResolvedValue({ id: 'u1', name: 'New Name' });
    const service = new UsersService({ update, findOneOrFail } as never);

    const result = await service.rename('u1', 'New Name');

    expect(update).toHaveBeenCalledWith('u1', { name: 'New Name' });
    expect(result).toMatchObject({ name: 'New Name' });
  });

  it('setPasswordHash writes only the hash', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const service = new UsersService({ update } as never);

    await service.setPasswordHash('u1', 'new-hash');

    expect(update).toHaveBeenCalledWith('u1', { passwordHash: 'new-hash' });
  });

  it('setAvatarFile points the user at the file id', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const findOneOrFail = vi.fn().mockResolvedValue({ id: 'u1', avatarFileId: 'f1' });
    const service = new UsersService({ update, findOneOrFail } as never);

    const result = await service.setAvatarFile('u1', 'f1');

    expect(update).toHaveBeenCalledWith('u1', { avatarFileId: 'f1' });
    expect(result).toMatchObject({ avatarFileId: 'f1' });
  });
});
