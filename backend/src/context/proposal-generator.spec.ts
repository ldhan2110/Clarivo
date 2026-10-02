import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeBlock } from './knowledge-block.entity';
import { KnowledgeRef } from './knowledge-ref.entity';
import type { ProjectDocument } from './project-document.entity';
import { ProposalGenerator } from './proposal-generator';

const TEXT = 'Invoices are imported nightly from the ERP. The depot runs offline for four hours.';

const DOCUMENT = {
  id: 'doc-1',
  projectId: 'project-1',
  uploadedBy: 'user-1',
  title: 'srs.pdf',
} as unknown as ProjectDocument;

function accepted(overrides: Partial<KnowledgeBlock> = {}): KnowledgeBlock {
  return {
    id: 'block-1',
    projectId: 'project-1',
    section: 'scope',
    statement: 'Invoices are imported weekly.',
    state: 'accepted',
    editedAt: null,
    position: 0,
    ...overrides,
  } as KnowledgeBlock;
}

let existing: KnowledgeBlock[];
let saved: { blocks: Partial<KnowledgeBlock>[]; refs: Partial<KnowledgeRef>[] };
let ai: { complete: ReturnType<typeof vi.fn> };
let generator: ProposalGenerator;

/** A transaction manager that records what was written. */
const dataSource = {
  transaction: async (work: (manager: any) => Promise<unknown>) => {
    let next = 0;
    return work({
      create: (target: unknown, input: Record<string, unknown>) => ({ target, ...input }),
      save: async (row: any) => {
        if (row.target === KnowledgeBlock) {
          next += 1;
          const block = { ...row, id: `new-${next}` };
          saved.blocks.push(block);
          return block;
        }
        saved.refs.push(row);
        return row;
      },
    });
  },
} as any;

function answer(...proposals: Record<string, unknown>[]) {
  return { proposals };
}

beforeEach(() => {
  existing = [accepted()];
  saved = { blocks: [], refs: [] };
  ai = { complete: vi.fn() };
  generator = new ProposalGenerator(
    { find: async () => existing } as any,
    ai as any,
    dataSource,
    { get: () => 'strong-model' } as any,
  );
});

describe('ProposalGenerator.generate', () => {
  it('persists a surviving add with its citation', async () => {
    ai.complete.mockResolvedValue(
      answer({
        kind: 'add',
        section: 'constraints',
        statement: 'The depot is offline for four hours.',
        confidence: 'stated',
        quote: 'The depot runs offline for four hours.',
        locator: 'p.2',
      }),
    );

    await generator.generate(DOCUMENT, 'a digest', TEXT);

    expect(saved.blocks).toHaveLength(1);
    expect(saved.blocks[0]).toMatchObject({
      state: 'proposed',
      origin: 'ai',
      kind: 'add',
      supersedesId: null,
      sourceDocumentId: 'doc-1',
      section: 'constraints',
    });
    expect(saved.refs[0]).toMatchObject({ documentId: 'doc-1', locator: 'p.2' });
  });

  it('never writes an accepted block — only proposals', async () => {
    ai.complete.mockResolvedValue(
      answer({
        kind: 'update',
        section: 'scope',
        statement: 'Invoices are imported nightly.',
        confidence: 'stated',
        supersedesId: 'block-1',
        quote: 'Invoices are imported nightly from the ERP.',
        locator: 'p.1',
      }),
    );

    await generator.generate(DOCUMENT, 'a digest', TEXT);

    expect(saved.blocks[0].state).toBe('proposed');
    // The target is left exactly as it was; accepting is the human's move.
    expect(existing[0].state).toBe('accepted');
  });

  it('stores an update targeting a human-edited block as a conflict', async () => {
    existing = [accepted({ editedAt: new Date() })];
    ai.complete.mockResolvedValue(
      answer({
        kind: 'update',
        section: 'scope',
        statement: 'Invoices are imported nightly.',
        confidence: 'stated',
        supersedesId: 'block-1',
        quote: 'Invoices are imported nightly from the ERP.',
      }),
    );

    await generator.generate(DOCUMENT, 'a digest', TEXT);

    expect(saved.blocks[0]).toMatchObject({ kind: 'conflict', supersedesId: 'block-1' });
  });

  it('tells the model which blocks are human-edited', async () => {
    existing = [accepted({ editedAt: new Date() })];
    ai.complete.mockResolvedValue(answer());

    await generator.generate(DOCUMENT, 'a digest', TEXT);

    const [request] = ai.complete.mock.calls[0];
    expect(request.user).toContain('EDITED BY A HUMAN');
    expect(request.system).toContain('conflict');
  });

  it('drops a fabricated quote and keeps the rest', async () => {
    ai.complete.mockResolvedValue(
      answer(
        {
          kind: 'add',
          section: 'scope',
          statement: 'real',
          confidence: 'stated',
          quote: 'Invoices are imported nightly from the ERP.',
        },
        {
          kind: 'add',
          section: 'scope',
          statement: 'invented',
          confidence: 'stated',
          quote: 'Payment terms are net 30.',
        },
      ),
    );

    await generator.generate(DOCUMENT, 'a digest', TEXT);

    expect(saved.blocks).toHaveLength(1);
    expect(saved.blocks[0].statement).toBe('real');
  });

  it('persists nothing when the client gives up after its retry', async () => {
    ai.complete.mockRejectedValue(
      Object.assign(new Error('malformed'), { code: 'AI_UNAVAILABLE' }),
    );

    await expect(generator.generate(DOCUMENT, 'a digest', TEXT)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    });
    expect(saved.blocks).toEqual([]);
    expect(saved.refs).toEqual([]);
  });

  it('drops an update whose target does not exist rather than failing the run', async () => {
    ai.complete.mockResolvedValue(
      answer({
        kind: 'update',
        section: 'scope',
        statement: 'about a block that is not there',
        confidence: 'stated',
        supersedesId: 'block-does-not-exist',
        quote: 'Invoices are imported nightly from the ERP.',
      }),
    );

    await generator.generate(DOCUMENT, 'a digest', TEXT);

    expect(saved.blocks).toEqual([]);
  });

  it('says the page is empty when a project has no accepted blocks', async () => {
    existing = [];
    ai.complete.mockResolvedValue(answer());

    await generator.generate(DOCUMENT, 'a digest', TEXT);

    expect(ai.complete.mock.calls[0][0].user).toContain('knowledge page is empty');
  });
});
