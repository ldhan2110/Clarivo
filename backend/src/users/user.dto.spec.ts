import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { UserDto } from './dto/user.dto';

describe('UserDto serialisation', () => {
  const source = {
    id: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    email: 'a@b.c',
    name: 'A',
    avatarFileId: 'f1',
    passwordHash: 'argon2-hash',
  };

  it('exposes avatarFileId', () => {
    const dto = plainToInstance(UserDto, source, { excludeExtraneousValues: true });
    expect(dto.avatarFileId).toBe('f1');
  });

  it('never serialises passwordHash', () => {
    const dto = plainToInstance(UserDto, source, { excludeExtraneousValues: true });
    expect(dto).not.toHaveProperty('passwordHash');
  });

  it('carries null when the user has no avatar', () => {
    const dto = plainToInstance(
      UserDto,
      { ...source, avatarFileId: null },
      { excludeExtraneousValues: true },
    );
    expect(dto.avatarFileId).toBeNull();
  });
});
