import { describe, expect, it } from 'vitest';
import { DocumentParser } from './document-parser';

const parser = new DocumentParser();

describe('DocumentParser', () => {
  it('extracts UTF-8 text from a TXT source', async () => {
    const buf = Buffer.from('Invoices import from the ERP nightly at 02:00.', 'utf-8');
    const result = await parser.parse(buf, 'text/plain');
    expect(result.text).toContain('Invoices import');
    expect(result.locator).toBeNull();
  });

  it('extracts markdown as text', async () => {
    const buf = Buffer.from('# Scope\n\nDispatch orders are raised against stock.', 'utf-8');
    const result = await parser.parse(buf, 'text/markdown');
    expect(result.text).toContain('Dispatch orders');
  });

  it('throws a readable error on an empty source', async () => {
    const buf = Buffer.from('   \n  ', 'utf-8');
    await expect(parser.parse(buf, 'text/plain')).rejects.toMatchObject({
      code: 'CONTEXT_UNREADABLE_SOURCE',
    });
  });

  it('rejects an unsupported type', async () => {
    const buf = Buffer.from('%!PS', 'utf-8');
    await expect(parser.parse(buf, 'application/postscript')).rejects.toMatchObject({
      code: 'CONTEXT_UNSUPPORTED_TYPE',
    });
  });
});
