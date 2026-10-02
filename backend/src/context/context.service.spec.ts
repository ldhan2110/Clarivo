import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { ContextService } from './context.service';
import { DocumentParser } from './document-parser';

// Minimal in-memory repo doubles so status transitions are observable.
function makeDocs() {
  const rows = new Map<string, any>();
  let n = 0;
  return {
    rows,
    create: (x: any) => ({ ...x }),
    save: async (r: any) => {
      const arr = Array.isArray(r) ? r : [r];
      for (const row of arr) {
        row.id ??= `d${++n}`;
        rows.set(row.id, row);
      }
      return r;
    },
    update: async (id: string, patch: any) => {
      Object.assign(rows.get(id), patch);
      return { affected: 1 };
    },
    find: async ({ where, order: _o }: any) =>
      [...rows.values()].filter(
        (d) => d.projectId === where.projectId && (!where.status || d.status === where.status),
      ),
    findOne: async ({ where }: any) => rows.get(where.id) ?? null,
    count: async ({ where }: any) =>
      [...rows.values()].filter((d) => d.projectId === where.projectId && d.status === where.status)
        .length,
  };
}

function makeKnowledge() {
  const byProject = new Map<string, any>();
  let n = 0;
  return {
    byProject,
    create: (x: any) => ({ ...x }),
    save: async (r: any) => {
      r.id ??= `k${++n}`;
      byProject.set(r.projectId, r);
      return r;
    },
    update: async (_id: string, patch: any) => {
      const existing = [...byProject.values()].find((k) => k.id === _id);
      Object.assign(existing, patch);
      return { affected: 1 };
    },
    findOne: async ({ where }: any) => byProject.get(where.projectId) ?? null,
  };
}

const project = { id: 'p1', domain: 'logistics', objective: 'x', customerBu: 'CLT' };

function build(overrides: Partial<Record<string, any>> = {}) {
  const documents = makeDocs();
  const knowledge = makeKnowledge();
  const projectRows = { findOne: async () => project };
  const files = {
    store: vi.fn(),
    findById: async (id: string) => ({ id, mimeType: 'text/plain', storageKey: 'k' }),
    createStream: () => Readable.from([Buffer.from('Invoices import from the ERP at 02:00.')]),
  };
  const ai = { summarise: vi.fn(async () => '## Overview\nText.\nSources: a.md') };
  const web = { search: vi.fn() };
  const projects = { requireProject: vi.fn(async () => ({})) };
  const svc = new ContextService(
    documents as any,
    knowledge as any,
    projectRows as any,
    files as any,
    new DocumentParser(),
    ai as any,
    web as any,
    projects as any,
  );
  Object.assign({ documents, knowledge, ai }, overrides);
  return { svc, documents, knowledge, ai };
}

describe('ContextService.runPipeline', () => {
  it('walks a doc source new → processed and generates the summary', async () => {
    const { svc, documents, knowledge, ai } = build();
    await documents.save({ projectId: 'p1', sourceType: 'doc', fileId: 'f1', status: 'new' });
    await svc.runPipeline('p1');
    expect([...documents.rows.values()][0].status).toBe('processed');
    expect(ai.summarise).toHaveBeenCalledOnce();
    expect(knowledge.byProject.get('p1').summaryMd).toContain('## Overview');
    expect(knowledge.byProject.get('p1').edited).toBe(false);
  });

  it('marks an unreadable source failed and still processes the rest', async () => {
    const { svc, documents, ai } = build();
    // a web source with no extract → fails; a doc source → succeeds
    await documents.save({ projectId: 'p1', sourceType: 'web', url: 'http://x', extractedText: '', status: 'new' });
    await documents.save({ projectId: 'p1', sourceType: 'doc', fileId: 'f1', status: 'new' });
    await svc.runPipeline('p1');
    const statuses = [...documents.rows.values()].map((d) => d.status).sort((a, b) => a.localeCompare(b));
    expect(statuses).toEqual(['failed', 'processed']);
    expect(ai.summarise).toHaveBeenCalledOnce(); // summary still generated from the good source
  });

  it('does not regenerate over a human-edited summary', async () => {
    const { svc, documents, knowledge, ai } = build();
    await knowledge.save({ projectId: 'p1', summaryMd: 'hand written', edited: true });
    await documents.save({ projectId: 'p1', sourceType: 'doc', fileId: 'f1', status: 'new' });
    await svc.runPipeline('p1');
    expect(ai.summarise).not.toHaveBeenCalled();
    expect(knowledge.byProject.get('p1').summaryMd).toBe('hand written');
  });
});

describe('ContextService.regenerate', () => {
  it('blocks when edited and no force', async () => {
    const { svc, knowledge } = build();
    await knowledge.save({ projectId: 'p1', summaryMd: 'mine', edited: true });
    await expect(svc.regenerate('p1', 'u1', false)).rejects.toMatchObject({
      code: 'CONTEXT_SUMMARY_EDITED',
    });
  });

  it('proceeds when forced', async () => {
    const { svc, knowledge, ai } = build();
    await knowledge.save({ projectId: 'p1', summaryMd: 'mine', edited: true });
    await svc.regenerate('p1', 'u1', true);
    expect(ai.summarise).toHaveBeenCalledOnce();
    expect(knowledge.byProject.get('p1').edited).toBe(false);
  });
});
