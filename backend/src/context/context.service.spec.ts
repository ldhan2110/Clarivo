import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectErrors } from '../projects/projects.errors';
import { ContextService, STALE_AFTER_MS } from './context.service';
import type { ProjectDocument } from './project-document.entity';

/** In-memory stand-in for Repository<ProjectDocument>. */
function fakeDocuments() {
  const rows: ProjectDocument[] = [];
  return {
    rows,
    create: (input: Partial<ProjectDocument>) => ({ ...input }) as ProjectDocument,
    save: vi.fn(async (row: ProjectDocument) => {
      row.id ??= `doc-${rows.length + 1}`;
      row.createdAt ??= new Date();
      row.updatedAt ??= new Date();
      rows.push(row);
      return row;
    }),
    find: vi.fn(async () => rows.filter((r) => r.status !== 'archived')),
    update: vi.fn(async (criteria: any, patch: any) => {
      // Mirrors the real In(...)/LessThan(...) predicate closely enough to
      // prove the sweep picks the right rows and leaves the rest alone.
      const stale = rows.filter(
        (r) =>
          ['pending', 'parsing', 'summarizing', 'proposing'].includes(r.status) &&
          r.updatedAt.getTime() < Date.now() - STALE_AFTER_MS,
      );
      for (const row of stale) Object.assign(row, patch);
      return { affected: stale.length };
    }),
    findOne: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
  };
}

/** Only acceptedBlockCounts touches this, and only through the query builder. */
function fakeBlocks() {
  return {
    delete: vi.fn(async () => ({ affected: 0 })),
    createQueryBuilder: () => ({
      select: function () {
        return this;
      },
      addSelect: function () {
        return this;
      },
      where: function () {
        return this;
      },
      andWhere: function () {
        return this;
      },
      groupBy: function () {
        return this;
      },
      getRawMany: async () => [],
    }),
  };
}

const MEMBER = 'user-member';
const STRANGER = 'user-stranger';

/** Flipped to 'archived' by the read-only tests. */
let projectStatus: 'active' | 'archived';
const PROJECT = 'project-1';

let documents: ReturnType<typeof fakeDocuments>;
let files: { store: ReturnType<typeof vi.fn> };
let projects: {
  requireMembership: ReturnType<typeof vi.fn>;
  requireProject: ReturnType<typeof vi.fn>;
};
let pipeline: { repropose: ReturnType<typeof vi.fn> };
let service: ContextService;

function upload(name = 'srs.pdf', mimetype = 'application/pdf') {
  return { path: `/tmp/${name}`, originalname: name, mimetype, size: 1024 };
}

beforeEach(() => {
  projectStatus = 'active';
  documents = fakeDocuments();
  let stored = 0;
  files = {
    store: vi.fn(async (file: any) => {
      stored += 1;
      return {
        id: `file-${stored}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      };
    }),
  };
  projects = {
    // The real gate throws 404 for a non-member; this mirrors it exactly.
    requireMembership: vi.fn(async (projectId: string, viewerId: string) => {
      if (viewerId !== MEMBER) throw ProjectErrors.NOT_FOUND({ id: projectId });
      return { role: 'member' };
    }),
    // requireProject runs the same gate first, then returns the row the
    // writability check reads.
    requireProject: vi.fn(async (projectId: string, viewerId: string) => {
      if (viewerId !== MEMBER) throw ProjectErrors.NOT_FOUND({ id: projectId });
      return { id: projectId, status: projectStatus };
    }),
  };
  pipeline = { repropose: vi.fn(async () => undefined) };
  service = new ContextService(
    documents as any,
    fakeBlocks() as any,
    files as any,
    projects as any,
    pipeline as any,
  );
});

describe('ContextService.uploadDocument', () => {
  it('stores the bytes and records a pending document titled from the filename', async () => {
    const document = await service.uploadDocument(PROJECT, upload(), MEMBER);

    expect(files.store).toHaveBeenCalledWith(expect.objectContaining({ originalname: 'srs.pdf' }), MEMBER);
    expect(document.status).toBe('pending');
    expect(document.title).toBe('srs.pdf');
    expect(document.projectId).toBe(PROJECT);
    expect(document.uploadedBy).toBe(MEMBER);
  });

  it('refuses a non-member with the project 404, never a context error', async () => {
    await expect(service.uploadDocument(PROJECT, upload(), STRANGER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
      status: 404,
    });
    // The gate runs before anything is written.
    expect(files.store).not.toHaveBeenCalled();
    expect(documents.save).not.toHaveBeenCalled();
  });

  it('keeps the same filename uploaded twice as two documents', async () => {
    const first = await service.uploadDocument(PROJECT, upload(), MEMBER);
    const second = await service.uploadDocument(PROJECT, upload(), MEMBER);

    expect(first.id).not.toBe(second.id);
    expect(first.fileId).not.toBe(second.fileId);
    expect(documents.rows).toHaveLength(2);
  });

  it('lets FilesService refuse an unsupported type and writes no row', async () => {
    files.store.mockRejectedValueOnce(
      Object.assign(new Error('unsupported'), { code: 'FILE_UNSUPPORTED_TYPE' }),
    );

    await expect(
      service.uploadDocument(PROJECT, upload('logo.svg', 'image/svg+xml'), MEMBER),
    ).rejects.toMatchObject({ code: 'FILE_UNSUPPORTED_TYPE' });
    expect(documents.save).not.toHaveBeenCalled();
  });
});

describe('ContextService.listDocuments', () => {
  it('gates the list on membership', async () => {
    await expect(service.listDocuments(PROJECT, STRANGER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });

  it('returns the uploaded documents with an honest zero block count', async () => {
    await service.uploadDocument(PROJECT, upload('srs.pdf'), MEMBER);
    documents.rows[0].file = {
      originalName: 'srs.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    } as any;

    const [dto] = await service.listDocuments(PROJECT, MEMBER);

    expect(dto.title).toBe('srs.pdf');
    expect(dto.mimeType).toBe('application/pdf');
    expect(dto.blockCount).toBe(0);
    expect(dto.fileId).toBe('file-1');
  });

  it('never exposes the storage key or the digest', async () => {
    await service.uploadDocument(PROJECT, upload(), MEMBER);
    documents.rows[0].digest = 'an expensive summary';

    const [dto] = await service.listDocuments(PROJECT, MEMBER);

    expect(Object.keys(dto)).not.toContain('storageKey');
    expect(Object.keys(dto)).not.toContain('digest');
  });

  it('leaves archived documents out of the list', async () => {
    await service.uploadDocument(PROJECT, upload('old.pdf'), MEMBER);
    documents.rows[0].status = 'archived';

    expect(await service.listDocuments(PROJECT, MEMBER)).toHaveLength(0);
  });
});

describe('ContextService.onModuleInit', () => {
  it('fails a document stranded mid-pipeline by a restart', async () => {
    await service.uploadDocument(PROJECT, upload(), MEMBER);
    documents.rows[0].status = 'parsing';
    documents.rows[0].updatedAt = new Date(Date.now() - STALE_AFTER_MS - 1000);

    await service.onModuleInit();

    expect(documents.rows[0].status).toBe('failed');
    expect(documents.rows[0].error).toMatch(/server restart/i);
  });

  it('leaves a document that is still being read alone', async () => {
    await service.uploadDocument(PROJECT, upload(), MEMBER);
    documents.rows[0].status = 'summarizing';
    documents.rows[0].updatedAt = new Date();

    await service.onModuleInit();

    expect(documents.rows[0].status).toBe('summarizing');
    expect(documents.rows[0].error).toBeUndefined();
  });

  it('never touches a document that already reached a terminal status', async () => {
    await service.uploadDocument(PROJECT, upload(), MEMBER);
    documents.rows[0].status = 'ready';
    documents.rows[0].updatedAt = new Date(Date.now() - STALE_AFTER_MS - 1000);

    await service.onModuleInit();

    expect(documents.rows[0].status).toBe('ready');
  });
});
