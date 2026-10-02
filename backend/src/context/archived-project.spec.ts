import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectErrors } from '../projects/projects.errors';
import { ContextService } from './context.service';
import { KnowledgeService } from './knowledge.service';
import { ProposalsService } from './proposals.service';
import { BriefGenerator } from './brief-generator';
import type { KnowledgeBlock } from './knowledge-block.entity';
import type { ProjectDocument } from './project-document.entity';

const PROJECT = 'project-1';
const MEMBER = 'user-member';

let status: 'active' | 'archived';
let context: ContextService;
let knowledge: KnowledgeService;
let proposals: ProposalsService;
let brief: BriefGenerator;

const document = {
  id: 'doc-1',
  projectId: PROJECT,
  fileId: 'file-1',
  title: 'SRS.pdf',
  status: 'ready',
  error: null,
  digest: 'a digest',
  file: { originalName: 'SRS.pdf', mimeType: 'application/pdf', sizeBytes: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as ProjectDocument;

const makeBlock = () =>
  ({
  id: 'block-1',
  projectId: PROJECT,
  section: 'scope',
  position: 0,
  statement: 's',
  confidence: 'stated',
  origin: 'ai',
  state: 'proposed',
  kind: 'add',
  supersedesId: null,
  sourceDocumentId: 'doc-1',
  editedAt: null,
  createdBy: MEMBER,
  createdAt: new Date(),
  updatedAt: new Date(),
  }) as KnowledgeBlock;

const projectsStub = () => ({
  requireMembership: vi.fn(async () => ({ role: 'member' })),
  requireProject: vi.fn(async (projectId: string) => ({ id: projectId, status })),
});

const noopQueryBuilder = {
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
  getCount: async () => 0,
};

beforeEach(() => {
  status = 'archived';

  const documents = {
    create: (input: Partial<ProjectDocument>) => ({ ...input }) as ProjectDocument,
    find: vi.fn(async () => [document]),
    findOne: vi.fn(async () => document),
    save: vi.fn(async (row: ProjectDocument) => row),
    createQueryBuilder: () => noopQueryBuilder,
  };
  const blocks = {
    find: vi.fn(async () => [makeBlock()]),
    findOne: vi.fn(async () => makeBlock()),
    remove: vi.fn(async (row: KnowledgeBlock) => row),
    delete: vi.fn(async () => ({ affected: 0 })),
    createQueryBuilder: () => noopQueryBuilder,
  };
  const refs = { find: vi.fn(async () => []) };
  const dataSource = {
    transaction: async (work: (manager: any) => Promise<unknown>) =>
      work({
        create: (_t: unknown, input: Record<string, unknown>) => ({ ...input }),
        save: async (row: any, maybe?: any) => maybe ?? row,
        update: async () => ({ affected: 1 }),
        delete: async () => ({ affected: 0 }),
      }),
  };

  context = new ContextService(
    documents as any,
    blocks as any,
    {
      store: vi.fn(async () => ({
        id: 'file-1',
        originalName: 'x.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1,
      })),
    } as any,
    projectsStub() as any,
    { repropose: vi.fn() } as any,
  );
  knowledge = new KnowledgeService(
    blocks as any,
    refs as any,
    documents as any,
    projectsStub() as any,
    { findById: async () => ({ name: 'Mia' }) } as any,
    dataSource as any,
  );
  proposals = new ProposalsService(
    blocks as any,
    refs as any,
    documents as any,
    projectsStub() as any,
    dataSource as any,
  );
  brief = new BriefGenerator(
    blocks as any,
    documents as any,
    projectsStub() as any,
    { complete: vi.fn(async () => ({ summary: 'a brief' })) } as any,
    dataSource as any,
    { get: () => 'strong-model' } as any,
  );
});

const upload = { path: '/tmp/x.pdf', originalname: 'x.pdf', mimetype: 'application/pdf', size: 1 };

describe('every context write on an archived project', () => {
  const writes: [string, () => Promise<unknown>][] = [
    ['upload a document', () => context.uploadDocument(PROJECT, upload, MEMBER)],
    ['rename a document', () => context.renameDocument(PROJECT, 'doc-1', 'New', MEMBER)],
    ['re-read a document', () => context.rereadDocument(PROJECT, 'doc-1', MEMBER)],
    ['archive a document', () => context.archiveDocument(PROJECT, 'doc-1', MEMBER)],
    [
      'create a block',
      () =>
        knowledge.createBlock(
          PROJECT,
          { section: 'scope', statement: 's', confidence: 'stated' },
          MEMBER,
        ),
    ],
    ['edit a block', () => knowledge.updateBlock(PROJECT, 'block-1', { statement: 's' }, MEMBER)],
    ['delete a block', () => knowledge.deleteBlock(PROJECT, 'block-1', MEMBER)],
    ['accept a proposal', () => proposals.accept(PROJECT, 'block-1', MEMBER)],
    ['reject a proposal', () => proposals.reject(PROJECT, 'block-1', MEMBER)],
    ['regenerate the brief', () => brief.regenerate(PROJECT, MEMBER)],
  ];

  it.each(writes)('refuses to %s with 409 PROJECT_ARCHIVED', async (_name, write) => {
    await expect(write()).rejects.toMatchObject({ code: 'PROJECT_ARCHIVED', status: 409 });
  });

  it.each(writes)('allows %s once the project is active again', async (_name, write) => {
    status = 'active';
    await expect(write()).resolves.not.toThrow();
  });
});

describe('every context read on an archived project', () => {
  it('lists documents', async () => {
    await expect(context.listDocuments(PROJECT, MEMBER)).resolves.toHaveLength(1);
  });

  it('resolves a document by id — its citations stay downloadable', async () => {
    await expect(context.findDocument(PROJECT, 'doc-1', MEMBER)).resolves.toMatchObject({
      id: 'doc-1',
    });
  });

  it('returns the knowledge page', async () => {
    await expect(knowledge.getPage(PROJECT, MEMBER)).resolves.toMatchObject({
      briefStaleCount: 0,
    });
  });

  it('lists proposals', async () => {
    await expect(proposals.list(PROJECT, MEMBER)).resolves.toBeInstanceOf(Array);
  });
});

describe('the archived check never leaks a project to a non-member', () => {
  it('still answers 404 first', async () => {
    const service = new ContextService(
      { find: async () => [] } as any,
      { createQueryBuilder: () => noopQueryBuilder } as any,
      { store: vi.fn() } as any,
      {
        requireProject: vi.fn(async (projectId: string) => {
          throw ProjectErrors.NOT_FOUND({ id: projectId });
        }),
      } as any,
      { repropose: vi.fn() } as any,
    );

    await expect(service.uploadDocument(PROJECT, upload, 'stranger')).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
      status: 404,
    });
  });
});
