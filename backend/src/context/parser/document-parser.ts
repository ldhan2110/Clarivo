import { readFile } from 'node:fs/promises';
import { ContextErrors } from '../context.errors';
import { parseDocx } from './docx.parser';
import { parsePdf } from './pdf.parser';
import { parseMarkdown, parsePlainText } from './text.parser';
import type { Segment } from './segment';

export type { Segment };

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Extracted text is never persisted: the bytes are on disk and re-parsing is
 * free, so only the digest — the part that costs money — is stored.
 *
 * An allowed type that carries no text (an image, a scanned PDF) is a
 * CONTEXT_UNSUPPORTED_DOCUMENT rather than an empty success: the document is
 * stored and downloadable, it just taught us nothing, and the UI says so.
 */
export async function extract(path: string, mimeType: string): Promise<Segment[]> {
  const segments = await dispatch(path, mimeType);
  const usable = segments.filter((segment) => segment.text.trim().length > 0);
  if (usable.length === 0) throw ContextErrors.UNSUPPORTED_DOCUMENT({ mimeType });
  return usable;
}

async function dispatch(path: string, mimeType: string): Promise<Segment[]> {
  switch (mimeType) {
    case 'application/pdf':
      return parsePdf(await readFile(path));
    case DOCX_MIME:
      return parseDocx(await readFile(path));
    case 'text/markdown':
      return parseMarkdown(await readFile(path, 'utf8'));
    case 'text/plain':
      return parsePlainText(await readFile(path, 'utf8'));
    default:
      // An image uploads and downloads; it just carries no text to learn from.
      return [];
  }
}
