import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextPipeline, GROUP_CHARS, groupSegments } from './context.pipeline';
import type { ProjectDocument } from './project-document.entity';

let base: string;
let document: ProjectDocument;
let documents: any;
let ai: { complete: ReturnType<typeof vi.fn> };
let proposals: { generate: ReturnType<typeof vi.fn> };
let pipeline: ContextPipeline;
let others: ProjectDocument[];

/** Writes a .md fixture and returns the storage key pointing at it. */
function storedMarkdown(body: string): string {
  const key = 'doc.md';
  writeFileSync(join(base, key), body);
  return key;
}

function build(storageKey: string, mimeType = 'text/markdown') {
  document = {
    id: 'doc-1',
    projectId: 'project-1',
    uploadedBy: 'user-1',
    title: 'srs.md',
    status: 'pending',
    error: null,
    digest: null,
    charCount: null,
    file: { storageKey, mimeType },
  } as unknown as ProjectDocument;

  others = [{ id: 'doc-2', status: 'ready', error: null } as unknown as ProjectDocument];

  documents = {
    findOne: vi.fn(async ({ where }: any) =>
      where.id === document.id ? document : (others.find((o) => o.id === where.id) ?? null),
    ),
    save: vi.fn(async (row: ProjectDocument) => row),
    update: vi.fn(async (id: string, patch: Partial<ProjectDocument>) => {
      if (id === document.id) Object.assign(document, patch);
      return { affected: 1 };
    }),
  };

  ai = { complete: vi.fn(async () => ({ summary: 'the digest' })) };
  proposals = { generate: vi.fn(async () => []) };

  return new ContextPipeline(
    documents,
    { absolute: (key: string) => join(base, key) } as any,
    ai as any,
    proposals as any,
    {
      get: (key: string) => (key === 'AI_MODEL_FAST' ? 'fast-model' : 'strong-model'),
    } as any,
  );
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'clarivo-pipeline-'));
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('groupSegments', () => {
  it('merges whole segments so a locator is never split', () => {
    const segments = [
      { text: 'a'.repeat(4000), locator: 'p.1' },
      { text: 'b'.repeat(4000), locator: 'p.2' },
      { text: 'c'.repeat(100), locator: 'p.3' },
    ];

    const groups = groupSegments(segments, GROUP_CHARS);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toContain('[p.1]');
    expect(groups[0]).not.toContain('[p.2]');
    expect(groups[1]).toContain('[p.2]');
    expect(groups[1]).toContain('[p.3]');
  });
});

describe('ContextPipeline.run', () => {
  it('walks to ready and stores the digest', async () => {
    pipeline = build(storedMarkdown('# Scope\nInvoices import nightly.'));

    await pipeline.run('doc-1');

    expect(document.status).toBe('ready');
    expect(document.digest).toBe('the digest');
    expect(document.charCount).toBeGreaterThan(0);
    expect(proposals.generate).toHaveBeenCalledOnce();
  });

  it('passes through parsing, summarizing and proposing on the way', async () => {
    pipeline = build(storedMarkdown('# Scope\nInvoices import nightly.'));
    const seen: string[] = [];
    documents.save.mockImplementation(async (row: ProjectDocument) => {
      seen.push(row.status);
      return row;
    });

    await pipeline.run('doc-1');

    expect(seen).toEqual(
      expect.arrayContaining(['parsing', 'summarizing', 'proposing', 'ready']),
    );
    expect(seen.indexOf('parsing')).toBeLessThan(seen.indexOf('summarizing'));
    expect(seen.indexOf('summarizing')).toBeLessThan(seen.indexOf('proposing'));
  });

  it('skips the map pass for a one-group document — the fast model never runs', async () => {
    pipeline = build(storedMarkdown('# Scope\nShort enough to fit one group.'));

    await pipeline.run('doc-1');

    const models = ai.complete.mock.calls.map(([request]) => request.model);
    expect(models).toEqual(['strong-model']);
  });

  it('maps with the fast model and reduces with the strong one when it does not fit', async () => {
    const long = Array.from(
      { length: 4 },
      (_, i) => `## Part ${i}\n${'word '.repeat(600)}`,
    ).join('\n');
    pipeline = build(storedMarkdown(long));

    await pipeline.run('doc-1');

    const models = ai.complete.mock.calls.map(([request]) => request.model);
    expect(models.filter((m: string) => m === 'fast-model').length).toBeGreaterThan(1);
    expect(models.at(-1)).toBe('strong-model');
  });

  it('lands failed with the parser message and never rejects', async () => {
    pipeline = build(storedMarkdown('   \n   \n'));

    await expect(pipeline.run('doc-1')).resolves.toBeUndefined();

    expect(document.status).toBe('failed');
    expect(document.error).toMatch(/No text could be extracted/);
  });

  it('leaves other documents and existing blocks untouched on a failure', async () => {
    pipeline = build(storedMarkdown('   '));

    await pipeline.run('doc-1');

    expect(others[0].status).toBe('ready');
    expect(proposals.generate).not.toHaveBeenCalled();
    // Only the failing row is written.
    expect(documents.update).toHaveBeenCalledWith('doc-1', expect.anything());
    expect(documents.update).toHaveBeenCalledTimes(1);
  });

  it('fails the document when the AI client gives up', async () => {
    pipeline = build(storedMarkdown('# Scope\nSomething real.'));
    ai.complete.mockRejectedValue(
      Object.assign(new Error('provider down'), { code: 'AI_UNAVAILABLE' }),
    );

    await pipeline.run('doc-1');

    expect(document.status).toBe('failed');
    expect(document.error).toBe('provider down');
  });

  it('caps concurrency at two documents in flight', async () => {
    pipeline = build(storedMarkdown('# Scope\nSomething real.'));
    let inFlight = 0;
    let peak = 0;
    ai.complete.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { summary: 'the digest' };
    });

    await Promise.all([0, 1, 2, 3, 4].map(() => pipeline.run('doc-1')));

    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe('ContextPipeline.repropose', () => {
  it('re-runs proposals from the stored digest without summarising again', async () => {
    pipeline = build(storedMarkdown('# Scope\nInvoices import nightly.'));
    document.digest = 'a digest from the first run';
    document.status = 'ready';

    await pipeline.repropose('doc-1');

    expect(ai.complete).not.toHaveBeenCalled();
    expect(proposals.generate).toHaveBeenCalledWith(
      document,
      'a digest from the first run',
      expect.stringContaining('Invoices'),
    );
    expect(document.status).toBe('ready');
  });

  it('fails readably when there is no digest to re-read', async () => {
    pipeline = build(storedMarkdown('# Scope\nAnything.'));
    document.digest = null;

    await pipeline.repropose('doc-1');

    expect(document.status).toBe('failed');
    expect(document.error).toMatch(/no digest/i);
  });
});
