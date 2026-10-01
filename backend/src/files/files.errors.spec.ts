import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { INLINE_MIME_TYPES, MAX_FILE_SIZE_BYTES, MIME_EXTENSIONS } from './files.constants';
import { FileErrors } from './files.errors';

describe('FileErrors', () => {
  it('prefixes every code with the FILE domain', () => {
    expect(FileErrors.NOT_FOUND().code).toBe('FILE_NOT_FOUND');
    expect(FileErrors.TOO_LARGE().code).toBe('FILE_TOO_LARGE');
    expect(FileErrors.UNSUPPORTED_TYPE().code).toBe('FILE_UNSUPPORTED_TYPE');
  });

  it('carries the right status on each', () => {
    expect(FileErrors.NOT_FOUND().getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(FileErrors.TOO_LARGE().getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(FileErrors.UNSUPPORTED_TYPE().getStatus()).toBe(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
  });

  it('passes details through', () => {
    expect(FileErrors.NOT_FOUND({ id: 'abc' }).details).toEqual({ id: 'abc' });
  });
});

describe('the allowlist', () => {
  it('excludes SVG', () => {
    expect(MIME_EXTENSIONS['image/svg+xml']).toBeUndefined();
    expect(INLINE_MIME_TYPES.has('image/svg+xml')).toBe(false);
  });

  it('covers exactly the agreed types', () => {
    expect(Object.keys(MIME_EXTENSIONS).sort()).toEqual(
      [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/gif',
        'image/jpeg',
        'image/png',
        'image/webp',
        'text/markdown',
        'text/plain',
      ].sort(),
    );
  });

  it('only ever shows raster images inline', () => {
    for (const mime of INLINE_MIME_TYPES) {
      expect(mime.startsWith('image/')).toBe(true);
      expect(MIME_EXTENSIONS[mime]).toBeDefined();
    }
  });

  it('caps uploads at 100 MB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(104857600);
  });
});
