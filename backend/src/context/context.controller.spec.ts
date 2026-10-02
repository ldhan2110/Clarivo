import { describe, expect, it, vi } from 'vitest';
import { ContextController } from './context.controller';
import { ContextErrors } from './context.errors';

const req = { user: { id: 'u1' } } as any;

function build(service: Partial<Record<string, any>>) {
  return new ContextController(service as any);
}

describe('ContextController', () => {
  it('uploads a document source', async () => {
    const addDocument = vi.fn(async () => ({
      id: 'd1',
      sourceType: 'doc',
      title: 'srs.pdf',
      url: null,
      status: 'new',
      failureReason: null,
      processedAt: null,
    }));
    const ctrl = build({ addDocument });
    const out = await ctrl.upload('p1', { originalname: 'srs.pdf' } as any, req);
    expect(addDocument).toHaveBeenCalledWith('p1', 'u1', { originalname: 'srs.pdf' });
    expect(out).toMatchObject({ id: 'd1', status: 'new' });
  });

  it('returns a research draft without persisting', async () => {
    const research = vi.fn(async () => ({
      findings_md: '### About',
      pages: [{ title: 'About', url: 'http://x', extract: 'text' }],
    }));
    const ctrl = build({ research });
    const out = await ctrl.research('p1', { companyName: 'SAMBU VINA' }, req);
    expect(research).toHaveBeenCalledWith('p1', 'u1', { companyName: 'SAMBU VINA' });
    expect(out.findings_md).toContain('About');
    expect(out.pages).toHaveLength(1);
  });

  it('persists accepted research pages', async () => {
    const acceptResearch = vi.fn(async () => [
      { id: 'w1', sourceType: 'web', title: 'About', url: 'http://x', status: 'new', failureReason: null, processedAt: null },
    ]);
    const ctrl = build({ acceptResearch });
    const out = await ctrl.acceptResearch('p1', { pages: [{ title: 'About', url: 'http://x', extract: 't' }] }, req);
    expect(acceptResearch).toHaveBeenCalledOnce();
    expect(out[0]).toMatchObject({ sourceType: 'web' });
  });

  it('propagates CONTEXT_SUMMARY_EDITED from regenerate without force', async () => {
    const regenerate = vi.fn(async () => {
      throw ContextErrors.SUMMARY_EDITED({ projectId: 'p1' });
    });
    const ctrl = build({ regenerate });
    await expect(ctrl.regenerate('p1', {}, req)).rejects.toMatchObject({
      code: 'CONTEXT_SUMMARY_EDITED',
    });
  });

  it('never serialises extracted_text in the context response', async () => {
    const getContext = vi.fn(async () => ({
      summaryMd: '## Overview',
      edited: false,
      generatedAt: null,
      processing: false,
      coverage: { covered: 1, total: 9 },
      // a source object that (wrongly) carries extractedText — the DTO must drop it
      sources: [
        { id: 'd1', sourceType: 'doc', title: 'srs.pdf', url: null, status: 'processed', failureReason: null, processedAt: null, extractedText: 'SECRET CORPUS' },
      ],
    }));
    const ctrl = build({ getContext });
    const out = await ctrl.get('p1', req);
    expect(JSON.stringify(out)).not.toContain('SECRET CORPUS');
    expect((out.sources[0] as any).extractedText).toBeUndefined();
  });

  it('answers 202 when a process run starts, 200 when nothing to do', async () => {
    const status = vi.fn();
    const res = { status } as any;
    const started = build({ processAll: vi.fn(async () => ({ started: true })) });
    await started.process('p1', req, res);
    expect(status).toHaveBeenCalledWith(202);

    const idle = build({ processAll: vi.fn(async () => ({ started: false })) });
    await idle.process('p1', req, { status } as any);
    expect(status).toHaveBeenCalledWith(200);
  });
});
