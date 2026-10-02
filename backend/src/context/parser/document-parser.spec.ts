import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extract } from './document-parser';

const fixture = (name: string) => join(__dirname, '__fixtures__', name);
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('extract', () => {
  it('returns one segment per PDF page, located by page number', async () => {
    const segments = await extract(fixture('two-pages.pdf'), 'application/pdf');

    expect(segments).toHaveLength(2);
    expect(segments[0].locator).toBe('p.1');
    expect(segments[0].text).toContain('invoicing scope');
    expect(segments[1].locator).toBe('p.2');
    expect(segments[1].text).toContain('stakeholders');
  });

  it('refuses a PDF with no text layer — a scan is stored, not read', async () => {
    await expect(extract(fixture('no-text.pdf'), 'application/pdf')).rejects.toMatchObject({
      code: 'CONTEXT_UNSUPPORTED_DOCUMENT',
    });
  });

  it('segments markdown on headings and keeps a preamble unlocated', async () => {
    const segments = await extract(fixture('brief.md'), 'text/markdown');

    expect(segments.map((s) => s.locator)).toEqual([null, '§Scope', '§Stakeholders']);
    expect(segments[1].text).toContain('imported nightly');
  });

  it('segments plain text on blank lines, located by starting line', async () => {
    const segments = await extract(fixture('notes.txt'), 'text/plain');

    expect(segments).toHaveLength(2);
    expect(segments[0].locator).toBe('line 1');
    expect(segments[1].locator).toBe('line 4');
    expect(segments[1].text).toContain('constraint');
  });

  it('refuses an image — it uploads and downloads, but teaches nothing', async () => {
    await expect(extract(fixture('notes.txt'), 'image/png')).rejects.toMatchObject({
      code: 'CONTEXT_UNSUPPORTED_DOCUMENT',
    });
  });

  it('carries the scanned-image wording the UI shows', async () => {
    await expect(extract(fixture('no-text.pdf'), 'application/pdf')).rejects.toThrow(
      /No text could be extracted/,
    );
  });

  it('parses a docx into heading-located segments', async () => {
    const segments = await extract(fixture('sample.docx'), DOCX_MIME);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments.some((s) => s.locator === '§Constraints')).toBe(true);
    expect(segments.map((s) => s.text).join(' ')).toContain('offline');
  });
});
