import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BriefGenerator } from './brief-generator';
import { KnowledgeBlock } from './knowledge-block.entity';
import { KnowledgeRef } from './knowledge-ref.entity';
import type { ProjectDocument } from './project-document.entity';

const PROJECT = 'project-1';
const MEMBER = 'user-member';

const project = {
  id: PROJECT,
  name: 'CLT-Invoicing',
  customerBu: 'Logistics BU',
  domain: 'Freight invoicing',
  objective: 'Replace the spreadsheet reconciliation.',
};

let documents: ProjectDocument[];
let accepted: KnowledgeBlock[];
let savedBlocks: any[];
let savedRefs: any[];
let ai: { complete: ReturnType<typeof vi.fn> };
let generator: BriefGenerator;

beforeEach(() => {
  savedBlocks = [];
  savedRefs = [];
  documents = [
    { id: 'doc-1', title: 'SRS-v2.pdf', digest: 'The SRS digest.', status: 'ready' },
    { id: 'doc-2', title: 'Kickoff.docx', digest: 'The kickoff digest.', status: 'ready' },
  ] as unknown as ProjectDocument[];
  accepted = [
    { id: 'block-1', section: 'scope', statement: 'Invoices import nightly.' } as KnowledgeBlock,
  ];
  ai = { complete: vi.fn(async () => ({ summary: 'A five-paragraph brief.' })) };

  const dataSource = {
    transaction: async (work: (manager: any) => Promise<unknown>) =>
      work({
        create: (target: unknown, input: Record<string, unknown>) => ({ target, ...input }),
        save: async (row: any) => {
          if (row.target === KnowledgeRef) {
            savedRefs.push(row);
            return row;
          }
          row.id = `brief-${savedBlocks.length + 1}`;
          savedBlocks.push(row);
          return row;
        },
      }),
  };

  generator = new BriefGenerator(
    { find: async () => accepted } as any,
    { find: async () => documents } as any,
    { requireProject: vi.fn(async () => project) } as any,
    ai as any,
    dataSource as any,
    { get: () => 'strong-model' } as any,
  );
});

describe('BriefGenerator.regenerate', () => {
  it('reads every digest plus the project fields and the accepted blocks', async () => {
    await generator.regenerate(PROJECT, MEMBER);

    const [request] = ai.complete.mock.calls[0];
    expect(request.model).toBe('strong-model');
    expect(request.user).toContain('The SRS digest.');
    expect(request.user).toContain('The kickoff digest.');
    expect(request.user).toContain('Freight invoicing');
    expect(request.user).toContain('Logistics BU');
    expect(request.user).toContain('Replace the spreadsheet reconciliation.');
    expect(request.user).toContain('Invoices import nightly.');
  });

  it('asks for the five fixed angles', async () => {
    await generator.regenerate(PROJECT, MEMBER);

    const [request] = ai.complete.mock.calls[0];
    for (const angle of [
      'What this is',
      'Who it is for',
      'What is being built',
      'What constrains it',
      'What is still unknown',
    ]) {
      expect(request.system).toContain(angle);
    }
  });

  it('proposes an add when no brief exists', async () => {
    const brief = await generator.regenerate(PROJECT, MEMBER);

    expect(brief).toMatchObject({
      section: 'overview',
      state: 'proposed',
      kind: 'add',
      supersedesId: null,
    });
  });

  it('proposes an update and leaves the live brief in place', async () => {
    accepted = [
      { id: 'live-brief', section: 'overview', statement: 'the old brief' } as KnowledgeBlock,
      ...accepted,
    ];

    const brief = await generator.regenerate(PROJECT, MEMBER);

    expect(brief).toMatchObject({ kind: 'update', supersedesId: 'live-brief', state: 'proposed' });
    // Still accepted: a regeneration proposes, it never overwrites.
    expect(accepted[0].state).toBeUndefined();
  });

  it('cites each document it read, with a null locator', async () => {
    await generator.regenerate(PROJECT, MEMBER);

    expect(savedRefs).toHaveLength(2);
    expect(savedRefs.every((ref) => ref.locator === null)).toBe(true);
    expect(savedRefs.map((ref) => ref.documentId)).toEqual(['doc-1', 'doc-2']);
  });

  it('is exempt from QuoteGuard — no verbatim span is required', async () => {
    ai.complete.mockResolvedValue({ summary: 'A synthesis no single document states.' });

    const brief = await generator.regenerate(PROJECT, MEMBER);

    expect(brief.statement).toBe('A synthesis no single document states.');
    expect(savedRefs).toHaveLength(2);
  });

  it('still produces a brief for a project with no documents', async () => {
    documents = [];
    accepted = [];

    const brief = await generator.regenerate(PROJECT, MEMBER);

    expect(brief.state).toBe('proposed');
    expect(ai.complete.mock.calls[0][0].user).toContain('No documents have been read yet');
  });

  it('gates regeneration on membership', async () => {
    generator = new BriefGenerator(
      { find: async () => accepted } as any,
      { find: async () => documents } as any,
      {
        requireProject: vi.fn(async () => {
          throw Object.assign(new Error('nope'), { code: 'PROJECT_NOT_FOUND' });
        }),
      } as any,
      ai as any,
      { transaction: async () => undefined } as any,
      { get: () => 'strong-model' } as any,
    );

    await expect(generator.regenerate(PROJECT, 'stranger')).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
    expect(ai.complete).not.toHaveBeenCalled();
  });
});
