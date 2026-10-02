import { convertToHtml } from 'mammoth';
import type { Segment } from './segment';

/**
 * Converts to HTML rather than raw text so heading structure survives and a
 * locator can be a `§` path. A document that uses no heading styles yields one
 * segment with a null locator — the quote then carries the whole burden, which
 * db.md records as an accepted open question.
 */
export async function parseDocx(buffer: Buffer): Promise<Segment[]> {
  const { value: html } = await convertToHtml({ buffer });

  const segments: Segment[] = [];
  let locator: string | null = null;
  let text = '';

  const push = () => {
    if (text.trim()) segments.push({ text: text.trim(), locator });
    text = '';
  };

  // Split on h1-h3 opening tags; everything up to the next one belongs to the
  // heading above it.
  for (const part of html.split(/(?=<h[1-3][\s>])/)) {
    const heading = /^<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/.exec(part);
    if (heading) {
      push();
      locator = `§${stripTags(heading[1]).trim()}`.slice(0, 64);
    }
    text += `${stripTags(part)}\n`;
  }
  push();

  return segments;
}

function stripTags(html: string): string {
  return html
    .replace(/<\/(p|div|li|h[1-6]|tr)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
