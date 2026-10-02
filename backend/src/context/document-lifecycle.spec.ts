import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectErrors } from '../projects/projects.errors';
import { ContextService } from './context.service';
import type { KnowledgeBlock } from './knowledge-block.entity';
import type { ProjectDocument } from './project-document.entity';

const PROJECT = 'project-1';
const MEMBER = 'user-member';
const STRANGER = 'user-stranger';

/** Flipped to 'archived' by the read-only tests. */
let projectStatus: 'active' | 'archived';

let rows: ProjectDocument[];
let blockRows: KnowledgeBlock[];
let refRows: { blockId: string; documentId: string }[];
let repropose: ReturnType<typeof vi.fn>;
let service: ContextService;

function document(overrides: Partial<ProjectDocument> = {}): ProjectDocument {
  return {
    id: 'doc-1',
    projectId: PROJECT,
    fileId: 'file-1',
    title: 'SRS-v2.pdf',
    status: 'ready',
    error: null,
    digest: 'a digest',
    file: { originalName: 'SRS-v2.pdf', mimeType: 'application/pdf', sizeBytes: 10 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as ProjectDocument;
}

beforeEach(() => {
  projectStatus = 'active';
  rows = [document()];
  blockRows = [
    { id: 'kept', sourceDocumentId: 'doc-1', state: 'accepted' } as KnowledgeBlock,
    { id: 'dropped', sourceDocumentId: 'doc-1', state: 'proposed' } as KnowledgeBlock,
  ];
  refRows = [{ blockId: 'kept', documentId: 'doc-1' }];
  repropose = vi.fn(async () => undefined);

  const documents = {
    find: vi.fn(async () => rows.filter((r) => r.status !== 'archived')),
    findOne: vi.fn(
      async ({ where }: any) =>
        rows.find((r) => r.id === where.id && r.projectId === where.projectId) ?? null,
    ),
    save: vi.fn(async (row: ProjectDocument) => row),
  };

  const blocks = {
    delete: vi.fn(async (where: { sourceDocumentId: string; state: string }) => {
      const before = blockRows.length;
      blockRows = blockRows.filter(
        (b) => !(b.sourceDocumentId === where.sourceDocumentId && b.state === where.state),
      );
      return { affected: before - blockRows.length };
    }),
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

  service = new ContextService(
    documents as any,
    blocks as any,
    { store: vi.fn() } as any,
    {
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
    } as any,
    { repropose } as any,
  );
});

describe('rename', () => {
  it('changes only the title', async () => {
    const renamed = await service.renameDocument(PROJECT, 'doc-1', 'Signed SRS', MEMBER);

    expect(renamed.title).toBe('Signed SRS');
    expect(renamed.fileId).toBe('file-1');
    expect(renamed.status).toBe('ready');
  });

  it('gates on membership', async () => {
    await expect(
      service.renameDocument(PROJECT, 'doc-1', 'Anything', STRANGER),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });
});

describe('re-read', () => {
  it('drops still-proposed blocks and keeps accepted ones', async () => {
    await service.rereadDocument(PROJECT, 'doc-1', MEMBER);

    expect(blockRows.map((b) => b.id)).toEqual(['kept']);
  });

  it('re-proposes from the stored digest and never re-parses', async () => {
    await service.rereadDocument(PROJECT, 'doc-1', MEMBER);

    expect(repropose).toHaveBeenCalledWith('doc-1');
  });

  it('404s an unknown document', async () => {
    await expect(service.rereadDocument(PROJECT, 'nope', MEMBER)).rejects.toMatchObject({
      code: 'CONTEXT_DOCUMENT_NOT_FOUND',
    });
  });
});

describe('archive', () => {
  it('leaves blocks and citations intact', async () => {
    await service.archiveDocument(PROJECT, 'doc-1', MEMBER);

    expect(blockRows).toHaveLength(2);
    expect(refRows).toHaveLength(1);
  });

  it('removes the document from the active list but keeps it resolvable by id', async () => {
    rows[0].status = 'archived';

    expect(await service.listDocuments(PROJECT, MEMBER)).toHaveLength(0);
    expect((await service.findDocument(PROJECT, 'doc-1', MEMBER)).id).toBe('doc-1');
  });

  it('is idempotent', async () => {
    rows[0].status = 'archived';

    const again = await service.archiveDocument(PROJECT, 'doc-1', MEMBER);

    expect(again.status).toBe('archived');
  });
});

describe('delete', () => {
  it('has no delete method and no delete route', () => {
    expect((service as unknown as Record<string, unknown>).deleteDocument).toBeUndefined();

    const controller = readdirSync(__dirname)
      .filter((name) => name === 'context.controller.ts')
      .map((name) => require('node:fs').readFileSync(join(__dirname, name), 'utf8'))
      .join('');
    // Deleting a document would strand the citations that make the page checkable.
    expect(controller).not.toMatch(/@Delete\(/);
  });
});
