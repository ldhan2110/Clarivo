import { HttpStatus } from '@nestjs/common';
import { defineErrors } from '../common/exceptions/domain-errors';

/**
 * INVALID_CREDENTIALS is thrown for BOTH an unknown email and a wrong password.
 * Distinguishing them would turn the login form into an account-existence oracle.
 */
export const AuthErrors = defineErrors('AUTH', {
  INVALID_CREDENTIALS: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Incorrect email or password',
  },
  UNAUTHENTICATED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Not authenticated',
  },
});
