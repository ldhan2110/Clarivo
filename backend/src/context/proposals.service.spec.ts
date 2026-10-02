import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectErrors } from '../projects/projects.errors';
import { KnowledgeBlock } from './knowledge-block.entity';
import { ProposalsService } from './proposals.service';

const PROJECT = 'project-1';
const MEMBER = 'user-member';
const STRANGER = 'user-stranger';

/** Flipped to 'archived' by the read-only tests. */
let projectStatus: 'active' | 'archived';

let rows: KnowledgeBlock[];
let refs: any[];
let service: ProposalsService;
let created: Partial<KnowledgeBlock>[];

function block(overrides: Partial<KnowledgeBlock>): KnowledgeBlock {
  return {
    id: 'block-x',
    projectId: PROJECT,
    section: 'scope',
    position: 0,
    statement: 'a statement',
    confidence: 'stated',
    origin: 'ai',
    state: 'proposed',
    kind: 'add',
    supersedesId: null,
    sourceDocumentId: 'doc-1',
    editedAt: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as KnowledgeBlock;
}

const find = (where: any) => {
  if (where.state) return rows.filter((r) => r.state === where.state);
  const ids: string[] = where.id?._value ?? where.id?.value ?? [];
  return rows.filter((r) => ids.includes(r.id));
};

beforeEach(() => {
  projectStatus = 'active';
  created = [];
  refs = [];
  rows = [];

  const blocks = {
    find: vi.fn(async ({ where }: any) => find(where)),
    findOne: vi.fn(async ({ where }: any) =>
      rows.find((r) => r.id === where.id && r.projectId === where.projectId) ?? null,
    ),
  };

  const dataSource = {
    transaction: async (work: (manager: any) => Promise<unknown>) =>
      work({
        create: (_target: unknown, input: Partial<KnowledgeBlock>) => {
          const row = block({ ...input, id: `written-${created.length + 1}` });
          created.push(row);
          return row;
        },
        save: async (row: KnowledgeBlock) => {
          rows.push(row);
          return row;
        },
        update: async (_target: unknown, id: string, patch: Partial<KnowledgeBlock>) => {
          const row = rows.find((r) => r.id === id);
          if (row) Object.assign(row, patch);
          return { affected: row ? 1 : 0 };
        },
      }),
  };

  service = new ProposalsService(
    blocks as any,
    { find: async () => refs } as any,
    { find: async () => [{ id: 'doc-1', title: 'srs.pdf' }] } as any,
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
    dataSource as any,
  );
});

describe('ProposalsService.accept', () => {
  it('accepts an add', async () => {
    rows = [block({ id: 'p1', kind: 'add' })];

    const result = await service.accept(PROJECT, 'p1', MEMBER);

    expect(result.state).toBe('accepted');
    expect(rows[0].state).toBe('accepted');
  });

  it('accepts an update and supersedes its target', async () => {
    rows = [
      block({ id: 'target', state: 'accepted', kind: 'add' }),
      block({ id: 'p1', kind: 'update', supersedesId: 'target' }),
    ];

    await service.accept(PROJECT, 'p1', MEMBER);

    expect(rows.find((r) => r.id === 'p1')!.state).toBe('accepted');
    // The superseded block is kept, not deleted — it is readable as history.
    expect(rows.find((r) => r.id === 'target')!.state).toBe('superseded');
  });

  it('resolves a conflict with keep_existing by rejecting the proposal', async () => {
    rows = [
      block({ id: 'target', state: 'accepted', kind: 'add' }),
      block({ id: 'p1', kind: 'conflict', supersedesId: 'target' }),
    ];

    await service.accept(PROJECT, 'p1', MEMBER, { resolution: 'keep_existing' });

    expect(rows.find((r) => r.id === 'p1')!.state).toBe('rejected');
    expect(rows.find((r) => r.id === 'target')!.state).toBe('accepted');
  });

  it('resolves a conflict with use_new by accepting it and superseding the target', async () => {
    rows = [
      block({ id: 'target', state: 'accepted', kind: 'add' }),
      block({ id: 'p1', kind: 'conflict', supersedesId: 'target' }),
    ];

    await service.accept(PROJECT, 'p1', MEMBER, { resolution: 'use_new' });

    expect(rows.find((r) => r.id === 'p1')!.state).toBe('accepted');
    expect(rows.find((r) => r.id === 'target')!.state).toBe('superseded');
  });

  it('resolves a conflict with write_own as a human block that supersedes the target', async () => {
    rows = [
      block({ id: 'target', state: 'accepted', kind: 'add' }),
      block({ id: 'p1', kind: 'conflict', supersedesId: 'target' }),
    ];

    const written = await service.accept(PROJECT, 'p1', MEMBER, {
      resolution: 'write_own',
      statement: 'Both are partly right: invoices import nightly except at month end.',
    });

    expect(written.origin).toBe('human');
    expect(written.state).toBe('accepted');
    expect(written.supersedesId).toBe('target');
    expect(written.editedAt).toBeInstanceOf(Date);
    // Both losing sides survive with their sources.
    expect(rows.find((r) => r.id === 'p1')!.state).toBe('rejected');
    expect(rows.find((r) => r.id === 'target')!.state).toBe('superseded');
  });

  it('refuses a conflict with no resolution rather than picking a side', async () => {
    rows = [
      block({ id: 'target', state: 'accepted', kind: 'add' }),
      block({ id: 'p1', kind: 'conflict', supersedesId: 'target' }),
    ];

    await expect(service.accept(PROJECT, 'p1', MEMBER)).rejects.toMatchObject({
      code: 'CONTEXT_CONFLICT_RESOLUTION_REQUIRED',
    });
    expect(rows.find((r) => r.id === 'p1')!.state).toBe('proposed');
  });

  it('refuses write_own with no statement', async () => {
    rows = [
      block({ id: 'target', state: 'accepted', kind: 'add' }),
      block({ id: 'p1', kind: 'conflict', supersedesId: 'target' }),
    ];

    await expect(
      service.accept(PROJECT, 'p1', MEMBER, { resolution: 'write_own', statement: '  ' }),
    ).rejects.toMatchObject({ code: 'CONTEXT_CONFLICT_RESOLUTION_REQUIRED' });
  });

  it('returns 409 on a double resolve', async () => {
    rows = [block({ id: 'p1', kind: 'add' })];
    await service.accept(PROJECT, 'p1', MEMBER);

    await expect(service.accept(PROJECT, 'p1', MEMBER)).rejects.toMatchObject({
      code: 'CONTEXT_PROPOSAL_ALREADY_RESOLVED',
      status: 409,
    });
  });

  it('404s an unknown block and gives a non-member the project 404', async () => {
    rows = [block({ id: 'p1' })];

    await expect(service.accept(PROJECT, 'nope', MEMBER)).rejects.toMatchObject({
      code: 'CONTEXT_BLOCK_NOT_FOUND',
    });
    await expect(service.accept(PROJECT, 'p1', STRANGER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});

describe('ProposalsService.reject', () => {
  it('rejects without deleting the row or its refs', async () => {
    rows = [block({ id: 'p1' })];
    refs = [{ id: 'ref-1', blockId: 'p1', quote: 'a quote', locator: 'p.1' }];

    await service.reject(PROJECT, 'p1', MEMBER);

    expect(rows).toHaveLength(1);
    expect(rows[0].state).toBe('rejected');
    expect(refs).toHaveLength(1);
  });

  it('returns 409 when the proposal was already accepted', async () => {
    rows = [block({ id: 'p1', state: 'accepted' })];

    await expect(service.reject(PROJECT, 'p1', MEMBER)).rejects.toMatchObject({
      code: 'CONTEXT_PROPOSAL_ALREADY_RESOLVED',
    });
  });
});

describe('ProposalsService.list', () => {
  it('groups by source document and carries each proposal target', async () => {
    rows = [
      block({ id: 'target', state: 'accepted', statement: 'the old wording' }),
      block({ id: 'p1', kind: 'update', supersedesId: 'target' }),
      block({ id: 'p2', kind: 'add' }),
    ];

    const groups = await service.list(PROJECT, MEMBER);

    expect(groups).toHaveLength(1);
    expect(groups[0].documentTitle).toBe('srs.pdf');
    expect(groups[0].proposals).toHaveLength(2);
    expect(groups[0].proposals.find((p) => p.id === 'p1')!.target!.statement).toBe(
      'the old wording',
    );
    expect(groups[0].proposals.find((p) => p.id === 'p2')!.target).toBeNull();
  });

  it('is empty when nothing is proposed, and gated on membership', async () => {
    rows = [block({ id: 'p1', state: 'accepted' })];

    expect(await service.list(PROJECT, MEMBER)).toEqual([]);
    await expect(service.list(PROJECT, STRANGER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});
