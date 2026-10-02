import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectErrors } from '../projects/projects.errors';
import type { FileEntity } from './file.entity';
import { FilesController } from './files.controller';

/**
 * The one security boundary in add-project-context, written before the change.
 *
 * Before this, `GET /files/:id` was JwtAuthGuard and nothing else: any
 * authenticated user could download any file by id. add-file-storage logged
 * that as known-and-accepted precisely because no file had an owner yet. This
 * change gives files owners, so the hole has to close in the same change that
 * opens it.
 *
 * The rule is narrow on purpose. A file WITH a `project_documents` row requires
 * membership of that project; a file WITHOUT one keeps exactly today's
 * behaviour, which is why the pre-existing orphan `files` rows need no data fix.
 */
const MEMBER = 'user-member';
const STRANGER = 'user-stranger';

const CONTEXT_FILE = {
  id: 'file-owned',
  storageKey: '2026/10/file-owned.pdf',
  originalName: 'SRS-v2.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
} as FileEntity;

const ORPHAN_FILE = {
  id: 'file-orphan',
  storageKey: '2026/09/file-orphan.pdf',
  originalName: 'leftover.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 512,
} as FileEntity;

let controller: FilesController;
let headers: Record<string, string>;
let requireMembership: ReturnType<typeof vi.fn>;
let documentsByFile: Map<string, { projectId: string }>;

function response() {
  headers = {};
  return { set: (values: Record<string, string>) => Object.assign(headers, values) } as never;
}

function request(userId: string) {
  return { user: { id: userId } } as never;
}

beforeEach(() => {
  documentsByFile = new Map([['file-owned', { projectId: 'project-1' }]]);

  requireMembership = vi.fn(async (projectId: string, viewerId: string) => {
    // The real gate throws 404, never 403 — a 403 would confirm it exists.
    if (viewerId !== MEMBER) throw ProjectErrors.NOT_FOUND({ id: projectId });
    return { role: 'member' };
  });

  const files = {
    findById: vi.fn(async (id: string) => {
      const file = [CONTEXT_FILE, ORPHAN_FILE].find((f) => f.id === id);
      if (!file) throw new Error('not found');
      return file;
    }),
    createStream: vi.fn(() => 'a readable stream'),
  };

  const documents = {
    findOne: vi.fn(async ({ where }: { where: { fileId: string } }) => {
      return documentsByFile.get(where.fileId) ?? null;
    }),
  };

  controller = new FilesController(files as any, documents as any, {
    requireMembership,
  } as any);
});

describe('GET /files/:id when the file is a context document', () => {
  it('lets a member of the owning project download it', async () => {
    await expect(
      controller.download('file-owned', response(), request(MEMBER)),
    ).resolves.toBeDefined();

    expect(requireMembership).toHaveBeenCalledWith('project-1', MEMBER);
    expect(headers['Content-Disposition']).toContain('SRS-v2.pdf');
  });

  it('gives a non-member 404, never 403', async () => {
    await expect(
      controller.download('file-owned', response(), request(STRANGER)),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND', status: 404 });
  });

  it('does not stream a single byte to a non-member', async () => {
    const files = (controller as unknown as { files: { createStream: ReturnType<typeof vi.fn> } })
      .files;

    await expect(
      controller.download('file-owned', response(), request(STRANGER)),
    ).rejects.toThrow();
    expect(files.createStream).not.toHaveBeenCalled();
  });
});

describe('GET /files/:id when the file has no project_documents row', () => {
  it('behaves exactly as before the change — any authenticated user', async () => {
    await expect(
      controller.download('file-orphan', response(), request(STRANGER)),
    ).resolves.toBeDefined();

    expect(requireMembership).not.toHaveBeenCalled();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });
});

describe('the download path', () => {
  it('stays the single route — no project-scoped duplicate serving the same bytes', () => {
    const source = require('node:fs').readFileSync(`${__dirname}/../context/context.controller.ts`, 'utf8');

    expect(source).not.toMatch(/StreamableFile/);
    expect(source).not.toMatch(/createStream/);
  });
});
