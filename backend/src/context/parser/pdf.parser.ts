import { PDFParse } from 'pdf-parse';
import type { Segment } from './segment';

/**
 * One segment per page, so a citation can say `p.12`.
 *
 * pdf-parse v2 is a class, not v1's default function; it loads cleanly under
 * CommonJS, which is the whole reason it was chosen (see design.md Default 14).
 */
export async function parsePdf(buffer: Buffer): Promise<Segment[]> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.pages.map((page) => ({
      text: page.text,
      locator: `p.${page.num}`,
    }));
  } finally {
    await parser.destroy();
  }
}
