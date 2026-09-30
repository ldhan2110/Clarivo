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
});
