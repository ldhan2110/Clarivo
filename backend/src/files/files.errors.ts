import { HttpStatus } from '@nestjs/common';
import { defineErrors } from '../common/exceptions/domain-errors';

/**
 * NOT_FOUND covers both an unknown id and a row whose bytes have gone missing
 * from disk. The second case is a server fault, but answering 500 would tell
 * the client to retry something that can never succeed.
 */
export const FileErrors = defineErrors('FILE', {
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'File not found',
  },
  TOO_LARGE: {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'File exceeds the 100 MB limit',
  },
  UNSUPPORTED_TYPE: {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    message: 'File type is not supported',
  },
});
