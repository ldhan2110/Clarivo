import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectErrors } from '../projects/projects.errors';
import { KNOWLEDGE_SECTIONS, KnowledgeBlock } from './knowledge-block.entity';
import { KnowledgeRef } from './knowledge-ref.entity';
import { KnowledgeService } from './knowledge.service';

const PROJECT = 'project-1';
const MEMBER = 'user-member';
const STRANGER = 'user-stranger';

/** Flipped to 'archived' by the read-only tests. */
let projectStatus: 'active' | 'archived';

let blockRows: KnowledgeBlock[];
let refRows: KnowledgeRef[];
let documentRows: any[];
let readyAfterBrief: number;
let service: KnowledgeService;

function block(overrides: Partial<KnowledgeBlock> = {}): KnowledgeBlock {
  return {
    id: `block-${blockRows.length + 1}`,
    projectId: PROJECT,
    section: 'scope',
    position: 0,
    statement: 'a statement',
    confidence: 'stated',
    origin: 'ai',
    state: 'accepted',
    kind: 'add',
    supersedesId: null,
    sourceDocumentId: 'doc-1',
    editedAt: null,
    createdBy: MEMBER,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as KnowledgeBlock;
}

beforeEach(() => {
  projectStatus = 'active';
  blockRows = [];
  refRows = [];
  readyAfterBrief = 0;
  documentRows = [{ id: 'doc-1', title: 'srs.pdf', fileId: 'file-1' }];

  const blocks = {
    find: vi.fn(async ({ where }: any) =>
      blockRows.filter((r) => !where.state || r.state === where.state),
    ),
    findOne: vi.fn(
      async ({ where }: any) =>
        blockRows.find((r) => r.id === where.id && r.projectId === where.projectId) ?? null,
    ),
    remove: vi.fn(async (row: KnowledgeBlock) => {
      blockRows = blockRows.filter((r) => r.id !== row.id);
      // The FK cascade takes the refs with it.
      refRows = refRows.filter((r) => r.blockId !== row.id);
      return row;
    }),
  };

  const dataSource = {
    transaction: async (work: (manager: any) => Promise<unknown>) =>
      work({
        create: (target: unknown, input: Record<string, unknown>) => ({ target, ...input }),
        save: async (target: any, maybeRow?: any) => {
          const row = maybeRow ?? target;
          if (row.target === KnowledgeRef || row instanceof Object && 'quote' in row) {
            row.id ??= `ref-${refRows.length + 1}`;
            refRows.push(row);
            return row;
          }
          row.id ??= `block-${blockRows.length + 1}`;
          row.createdAt ??= new Date();
          row.updatedAt ??= new Date();
          if (!blockRows.includes(row)) blockRows.push(row);
          return row;
        },
        delete: async (_target: unknown, where: { blockId: string }) => {
          refRows = refRows.filter((r) => r.blockId !== where.blockId);
        },
      }),
  };

  service = new KnowledgeService(
    blocks as any,
    { find: async () => refRows } as any,
    {
      find: async () => documentRows,
      createQueryBuilder: () => ({
        where: function () {
          return this;
        },
        andWhere: function () {
          return this;
        },
        getCount: async () => readyAfterBrief,
      }),
    } as any,
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
    { findById: async () => ({ id: MEMBER, name: 'Mia Member' }) } as any,
    dataSource as any,
  );
});

describe('KnowledgeService.getPage', () => {
  it('returns all nine sections in the fixed order, empty ones included', async () => {
    blockRows = [block({ section: 'constraints' })];

    const page = await service.getPage(PROJECT, MEMBER);

    expect(page.sections.map((s) => s.section)).toEqual(KNOWLEDGE_SECTIONS);
    expect(page.sections[0].section).toBe('overview');
    expect(page.sections.find((s) => s.section === 'constraints')!.blocks).toHaveLength(1);
    expect(page.sections.find((s) => s.section === 'glossary')!.blocks).toEqual([]);
  });

  it('returns only accepted blocks — a proposal is invisible on the page', async () => {
    blockRows = [block({ state: 'proposed' }), block({ state: 'accepted' })];

    const page = await service.getPage(PROJECT, MEMBER);

    expect(page.sections.flatMap((s) => s.blocks)).toHaveLength(1);
  });

  it('carries each citation with the title and file id a chip needs', async () => {
    blockRows = [block({ id: 'block-1' })];
    refRows = [
      { id: 'ref-1', blockId: 'block-1', documentId: 'doc-1', locator: 'p.4', quote: 'q' } as KnowledgeRef,
    ];

    const page = await service.getPage(PROJECT, MEMBER);
    const [ref] = page.sections.flatMap((s) => s.blocks)[0].refs;

    expect(ref).toMatchObject({ title: 'srs.pdf', fileId: 'file-1', locator: 'p.4' });
  });

  it('attributes a human block to its author and leaves AI blocks unattributed', async () => {
    blockRows = [block({ origin: 'human' }), block({ origin: 'ai' })];

    const blocks = (await service.getPage(PROJECT, MEMBER)).sections.flatMap((s) => s.blocks);

    expect(blocks.find((b) => b.origin === 'human')!.authorName).toBe('Mia Member');
    expect(blocks.find((b) => b.origin === 'ai')!.authorName).toBeNull();
  });

  it('counts documents read since the brief was written, and never regenerates', async () => {
    blockRows = [block({ section: 'overview' })];
    readyAfterBrief = 3;

    expect((await service.getPage(PROJECT, MEMBER)).briefStaleCount).toBe(3);
  });

  it('reports no stale count when there is no brief yet', async () => {
    blockRows = [block({ section: 'scope' })];
    readyAfterBrief = 3;

    expect((await service.getPage(PROJECT, MEMBER)).briefStaleCount).toBe(0);
  });

  it('gives a non-member the project 404', async () => {
    await expect(service.getPage(PROJECT, STRANGER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});

describe('KnowledgeService.createBlock', () => {
  it('creates an accepted human block with no refs', async () => {
    const created = await service.createBlock(
      PROJECT,
      { section: 'glossary', statement: 'A depot is a physical hub.', confidence: 'stated' },
      MEMBER,
    );

    expect(created).toMatchObject({ origin: 'human', state: 'accepted', kind: 'add' });
    expect(created.refs).toEqual([]);
    expect(created.sourceDocumentId).toBeNull();
  });

  it('stores citations when the author supplies them', async () => {
    const created = await service.createBlock(
      PROJECT,
      {
        section: 'scope',
        statement: 'Invoices import nightly.',
        confidence: 'stated',
        refs: [{ documentId: 'doc-1', locator: 'p.2', quote: 'nightly' }],
      },
      MEMBER,
    );

    expect(created.refs).toHaveLength(1);
    expect(created.refs[0]).toMatchObject({ locator: 'p.2', title: 'srs.pdf' });
  });

  it('gates creation on membership', async () => {
    await expect(
      service.createBlock(
        PROJECT,
        { section: 'scope', statement: 's', confidence: 'stated' },
        STRANGER,
      ),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });
});

describe('KnowledgeService.updateBlock', () => {
  it('sets edited_at so no document can silently replace it afterwards', async () => {
    blockRows = [block({ id: 'block-1', editedAt: null })];

    const updated = await service.updateBlock(
      PROJECT,
      'block-1',
      { statement: 'Invoices import nightly except at month end.' },
      MEMBER,
    );

    expect(updated.editedAt).toBeInstanceOf(Date);
    expect(updated.statement).toContain('month end');
  });

  it('replaces the citation set when refs are supplied', async () => {
    blockRows = [block({ id: 'block-1' })];
    refRows = [{ id: 'ref-old', blockId: 'block-1', documentId: 'doc-1', locator: 'p.1', quote: 'old' } as KnowledgeRef];

    const updated = await service.updateBlock(
      PROJECT,
      'block-1',
      { refs: [{ documentId: 'doc-1', locator: 'p.9', quote: 'new' }] },
      MEMBER,
    );

    expect(updated.refs).toHaveLength(1);
    expect(updated.refs[0].locator).toBe('p.9');
  });

  it('404s an unknown block and gates on membership', async () => {
    blockRows = [block({ id: 'block-1' })];

    await expect(service.updateBlock(PROJECT, 'nope', {}, MEMBER)).rejects.toMatchObject({
      code: 'CONTEXT_BLOCK_NOT_FOUND',
    });
    await expect(service.updateBlock(PROJECT, 'block-1', {}, STRANGER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});

describe('KnowledgeService.deleteBlock', () => {
  it('removes the block and its citations from the page', async () => {
    blockRows = [block({ id: 'block-1' })];
    refRows = [{ id: 'ref-1', blockId: 'block-1', documentId: 'doc-1', quote: 'q' } as KnowledgeRef];

    await service.deleteBlock(PROJECT, 'block-1', MEMBER);

    expect(blockRows).toHaveLength(0);
    expect(refRows).toHaveLength(0);
  });

  it('gates deletion on membership', async () => {
    blockRows = [block({ id: 'block-1' })];

    await expect(service.deleteBlock(PROJECT, 'block-1', STRANGER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
    expect(blockRows).toHaveLength(1);
  });
});
