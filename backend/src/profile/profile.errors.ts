import { HttpStatus } from '@nestjs/common';
import { defineErrors } from '../common/exceptions/domain-errors';

/**
 * INVALID_CURRENT_PASSWORD may name itself plainly: the caller is already
 * authenticated, so there is no account-existence oracle to protect (unlike
 * AuthErrors.INVALID_CREDENTIALS on the login path).
 */
export const ProfileErrors = defineErrors('PROFILE', {
  INVALID_CURRENT_PASSWORD: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Current password is incorrect',
  },
});
