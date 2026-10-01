import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileEntity } from './file.entity';
import { FilesService, type UploadedFile } from './files.service';

/** Minimal in-memory stand-in for Repository<FileEntity>. */
function fakeRepo() {
  const rows = new Map<string, FileEntity>();
  return {
    rows,
    create: (input: Partial<FileEntity>) => Object.assign(new FileEntity(), input),
    save: vi.fn(async (entity: FileEntity) => {
      rows.set(entity.id, entity);
      return entity;
    }),
    findOne: async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
    remove: vi.fn(async (entity: FileEntity) => {
      rows.delete(entity.id);
      return entity;
    }),
  };
}

let base: string;
let repo: ReturnType<typeof fakeRepo>;
let service: FilesService;

function build() {
  repo = fakeRepo();
  return new FilesService(repo as any, {
    get: () => base,
  } as any);
}

/** Puts a file in the staging dir the way multer's diskStorage would. */
function staged(contents = 'hello', name = 'upload.bin'): string {
  const path = join(service.tmpDir, name);
  writeFileSync(path, contents);
  return path;
}

function upload(over: Partial<UploadedFile> = {}): UploadedFile {
  return {
    path: staged(),
    originalname: 'notes.pdf',
    mimetype: 'application/pdf',
    size: 5,
    ...over,
  };
}

beforeEach(async () => {
  base = mkdtempSync(join(tmpdir(), 'clarivo-files-'));
  service = build();
  await service.onModuleInit();
});

afterEach(() => rmSync(base, { recursive: true, force: true }));

describe('onModuleInit', () => {
  it('creates the storage root and its staging dir', async () => {
    const fresh = join(base, 'nested', 'deeper');
    base = fresh;
    const svc = build();
    await svc.onModuleInit();
    expect(existsSync(join(fresh, 'tmp'))).toBe(true);
  });
});

describe('store', () => {
  it('writes to a date-sharded relative key and keeps the key relative', async () => {
    const file = await service.store(upload(), 'user-1');
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');

    expect(file.storageKey).toBe(`${now.getUTCFullYear()}/${month}/${file.id}.pdf`);
    expect(file.storageKey.startsWith('/')).toBe(false);
    expect(existsSync(join(base, file.storageKey))).toBe(true);
    expect(readFileSync(join(base, file.storageKey), 'utf8')).toBe('hello');
  });

  it('records the uploader, original name, mime and size', async () => {
    const file = await service.store(upload(), 'user-7');
    expect(file.uploadedBy).toBe('user-7');
    expect(file.originalName).toBe('notes.pdf');
    expect(file.mimeType).toBe('application/pdf');
    expect(file.sizeBytes).toBe(5);
    expect(typeof file.sizeBytes).toBe('number');
  });

  it('takes the extension from the mime type, not the filename', async () => {
    const file = await service.store(
      upload({ originalname: 'screenshot.pdf.txt', mimetype: 'image/png' }),
      'user-1',
    );
    expect(file.storageKey.endsWith('.png')).toBe(true);
  });

  it('refuses a type outside the allowlist and drops the staged bytes', async () => {
    const file = upload({ mimetype: 'application/x-msdownload' });
    await expect(service.store(file, 'user-1')).rejects.toMatchObject({
      code: 'FILE_UNSUPPORTED_TYPE',
    });
    expect(existsSync(file.path)).toBe(false);
    expect(repo.rows.size).toBe(0);
  });

  it('refuses SVG', async () => {
    await expect(
      service.store(upload({ mimetype: 'image/svg+xml' }), 'user-1'),
    ).rejects.toMatchObject({ code: 'FILE_UNSUPPORTED_TYPE' });
  });

  it('cannot be walked out of the storage root by the original name', async () => {
    const file = await service.store(
      upload({ originalname: '../../../etc/passwd.pdf' }),
      'user-1',
    );
    expect(file.originalName).toBe('../../../etc/passwd.pdf');
    expect(file.storageKey).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]+\.pdf$/);
    expect(file.storageKey).not.toContain('..');
    expect(existsSync(join(base, file.storageKey))).toBe(true);
  });

  it('does not leave bytes behind when the insert fails', async () => {
    repo.save.mockRejectedValueOnce(new Error('constraint violation'));
    await expect(service.store(upload(), 'user-1')).rejects.toThrow('constraint violation');

    const shard = join(base, String(new Date().getUTCFullYear()));
    const leftovers = existsSync(shard)
      ? readdirSync(shard, { recursive: true }).map(String)
      : [];
    expect(leftovers.filter((entry) => entry.endsWith('.pdf'))).toEqual([]);
    expect(repo.rows.size).toBe(0);
  });
});

describe('findById', () => {
  it('throws NOT_FOUND for an unknown id', async () => {
    await expect(service.findById('missing')).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });

  it('returns the stored row', async () => {
    const stored = await service.store(upload(), 'user-1');
    expect((await service.findById(stored.id)).id).toBe(stored.id);
  });
});

describe('createStream', () => {
  it('streams the stored bytes', async () => {
    const stored = await service.store(upload(), 'user-1');
    const chunks: Buffer[] = [];
    for await (const chunk of service.createStream(stored)) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe('hello');
  });

  it('throws NOT_FOUND and logs when the bytes are gone', async () => {
    const stored = await service.store(upload(), 'user-1');
    rmSync(join(base, stored.storageKey));

    const logged = vi.spyOn((service as any).logger, 'error');
    expect(() => service.createStream(stored)).toThrowError(
      expect.objectContaining({ code: 'FILE_NOT_FOUND' }),
    );
    expect(logged).toHaveBeenCalledOnce();
  });
});

describe('remove', () => {
  it('deletes the row and the bytes', async () => {
    const stored = await service.store(upload(), 'user-1');
    await service.remove(stored.id);
    expect(repo.rows.size).toBe(0);
    expect(existsSync(join(base, stored.storageKey))).toBe(false);
  });

  it('still deletes the row when the bytes are already gone', async () => {
    const stored = await service.store(upload(), 'user-1');
    rmSync(join(base, stored.storageKey));

    const warned = vi.spyOn((service as any).logger, 'warn');
    await expect(service.remove(stored.id)).resolves.toBeUndefined();
    expect(repo.rows.size).toBe(0);
    expect(warned).toHaveBeenCalledOnce();
  });

  it('throws NOT_FOUND for an unknown id', async () => {
    await expect(service.remove('missing')).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
  });
});
