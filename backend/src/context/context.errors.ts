import { HttpStatus } from '@nestjs/common';
import { defineErrors } from '../common/exceptions/domain-errors';

/**
 * Project-level failures keep reusing ProjectErrors — a non-member must get the
 * project's own 404 PROJECT_NOT_FOUND, never a context-flavoured one that
 * confirms the project exists.
 */
export const ContextErrors = defineErrors('CONTEXT', {
  DOCUMENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Document not found',
  },
  BLOCK_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Knowledge block not found',
  },
  /** An allowed upload type that carries no text — a scan, or an image. */
  UNSUPPORTED_DOCUMENT: {
    status: HttpStatus.BAD_REQUEST,
    message:
      'No text could be extracted — this looks like a scanned image. Clarivo does not read ' +
      'images, so nothing was learned from it. The file is still stored and downloadable.',
  },
  DOCUMENT_NOT_READY: {
    status: HttpStatus.CONFLICT,
    message: 'This document is still being read',
  },
  PROPOSAL_ALREADY_RESOLVED: {
    status: HttpStatus.CONFLICT,
    message: 'This proposal has already been resolved',
  },
  /**
   * Accepting a conflict is a choice between two recorded sources, so the body
   * must say which. Not in design.md Default 5's list because the list was
   * written before the three-way resolution had a body — same shape, 400 like
   * UNSUPPORTED_DOCUMENT.
   */
  CONFLICT_RESOLUTION_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Resolving a conflict needs a resolution: keep_existing, use_new or write_own',
  },
  DOCUMENT_ARCHIVED: {
    status: HttpStatus.CONFLICT,
    message: 'This document is archived',
  },
});
