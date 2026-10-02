import { HttpStatus } from '@nestjs/common';
import { defineErrors } from '../common/exceptions/domain-errors';

/**
 * 502 rather than 500: the failure is upstream, and the distinction is what
 * tells a caller the request itself was fine.
 */
export const AiErrors = defineErrors('AI', {
  UNAVAILABLE: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'The AI provider did not return a usable response',
  },
});
