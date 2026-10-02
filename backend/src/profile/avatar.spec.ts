import { describe, expect, it, vi } from 'vitest';
import { ProfileController } from './profile.controller';
import { AVATAR_MIME_TYPES } from './profile.constants';

const req = { user: { id: 'u1' } } as never;

describe('ProfileController.uploadAvatar', () => {
  it('stores the file then points the user at it and returns the UserDto', async () => {
    const store = vi.fn().mockResolvedValue({ id: 'f-new' });
    const setAvatarFile = vi
      .fn()
      .mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A', avatarFileId: 'f-new' });
    const controller = new ProfileController(
      {} as never,
      { store } as never,
      { setAvatarFile } as never,
    );

    const file = { mimetype: 'image/png' } as never;
    const dto = await controller.uploadAvatar(file, req, {});

    expect(store).toHaveBeenCalledWith(file, 'u1');
    expect(setAvatarFile).toHaveBeenCalledWith('u1', 'f-new');
    expect(dto.avatarFileId).toBe('f-new');
  });

  it('rejects a request with no file', async () => {
    const controller = new ProfileController({} as never, {} as never, {} as never);
    const err = await controller.uploadAvatar(undefined as never, req, {}).catch((e) => e);
    expect(err.code).toBe('FILE_UNSUPPORTED_TYPE');
  });
});

describe('AVATAR_MIME_TYPES', () => {
  it('allows raster images and excludes svg and documents', () => {
    expect(AVATAR_MIME_TYPES.has('image/png')).toBe(true);
    expect(AVATAR_MIME_TYPES.has('image/jpeg')).toBe(true);
    expect(AVATAR_MIME_TYPES.has('image/svg+xml')).toBe(false);
    expect(AVATAR_MIME_TYPES.has('application/pdf')).toBe(false);
  });
});
