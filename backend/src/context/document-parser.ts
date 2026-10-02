import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { ContextErrors } from './context.errors';

export interface ParseResult {
  text: string;
  /** Best-effort origin hint — null when the parser can locate nothing. */
  locator: string | null;
}

const MIME = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  TXT: 'text/plain',
  MD: 'text/markdown',
} as const;

/**
 * Extracts plain text from an uploaded document. Dispatches on mime type over
 * the two parsers already in the project (`pdf-parse`, `mammoth`, both CJS-safe)
 * plus a UTF-8 read for text. A source that yields no text throws
 * `CONTEXT_UNREADABLE_SOURCE` so the caller can mark it failed and move on —
 * there is no OCR, so a scanned PDF fails readably rather than silently.
 */
@Injectable()
export class DocumentParser {
  async parse(buffer: Buffer, mimeType: string): Promise<ParseResult> {
    const text = await this.extract(buffer, mimeType);
    const trimmed = text.trim();
    if (!trimmed) {
      throw ContextErrors.UNREADABLE_SOURCE({ mimeType });
    }
    return { text: trimmed, locator: null };
  }

  private async extract(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case MIME.PDF: {
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        try {
          const result = await parser.getText();
          return result.text ?? '';
        } finally {
          await parser.destroy();
        }
      }
      case MIME.DOCX: {
        const { value } = await mammoth.extractRawText({ buffer });
        return value ?? '';
      }
      case MIME.TXT:
      case MIME.MD:
        return buffer.toString('utf-8');
      default:
        throw ContextErrors.UNSUPPORTED_TYPE({ mimeType });
    }
  }
}
