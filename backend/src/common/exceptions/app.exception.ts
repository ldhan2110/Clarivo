import { HttpException, HttpStatus } from '@nestjs/common';

/** Domain error with a stable machine-readable code. */
export class AppException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: unknown,
  ) {
    super(message, status);
  }
}
