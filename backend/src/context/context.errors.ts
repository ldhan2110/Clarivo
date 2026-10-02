import { HttpStatus } from '@nestjs/common';
import { defineErrors } from '../common/exceptions/domain-errors';

export const ContextErrors = defineErrors('CONTEXT', {
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Context not found',
  },
  /** A source whose bytes yield no extractable text (e.g. a scanned PDF). */
  UNREADABLE_SOURCE: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'No extractable text in this source',
  },
  /** An uploaded file whose mime type no parser handles. */
  UNSUPPORTED_TYPE: {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    message: 'Unsupported document type',
  },
  /** Research request with neither a company name nor a URL. */
  RESEARCH_QUERY_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Provide a company name or a URL',
  },
  /** Regenerate refused because a human has edited the summary. */
  SUMMARY_EDITED: {
    status: HttpStatus.CONFLICT,
    message: 'Summary was edited by hand; pass force to overwrite',
  },
});
