import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { FilesController } from './files.controller';
import { ProjectErrors } from '../projects/projects.errors';

const file = {
  id: 'f1',
  mimeType: 'application/pdf',
  sizeBytes: 10,
  originalName: 'srs.pdf',
  storageKey: 'k',
};

function build(doc: unknown, requireMembership: () => Promise<unknown>) {
  const files = {
    findById: vi.fn(async () => file),
    createStream: vi.fn(() => Readable.from([Buffer.from('bytes')])),
  };
  const documents = { findOne: vi.fn(async () => doc) };
  const projects = { requireMembership: vi.fn(requireMembership) };
  const ctrl = new FilesController(files as any, documents as any, projects as any);
  return { ctrl, files, documents, projects };
}

const req = { user: { id: 'u1' } } as any;
const res = { set: vi.fn() } as any;

describe('FilesController.download authorisation', () => {
  it('lets a member download a document-backed file', async () => {
    const { ctrl, projects } = build({ projectId: 'p1' }, async () => ({ role: 'member' }));
    const out = await ctrl.download('f1', req, res);
    expect(projects.requireMembership).toHaveBeenCalledWith('p1', 'u1');
    expect(out).toBeDefined();
  });

  it('refuses a non-member (requireMembership throws, non-leaking)', async () => {
    const { ctrl } = build({ projectId: 'p1' }, async () => {
      throw ProjectErrors.NOT_FOUND({ id: 'p1' });
    });
    await expect(ctrl.download('f1', req, res)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });

  it('leaves a file that backs no document unchanged', async () => {
    const { ctrl, projects } = build(null, async () => ({}));
    const out = await ctrl.download('f1', req, res);
    expect(projects.requireMembership).not.toHaveBeenCalled();
    expect(out).toBeDefined();
  });
});
