import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { catchError, type Observable, throwError } from 'rxjs';
import { FileErrors } from './files.errors';

/**
 * Gives multer's size-limit rejection the FILE domain code.
 *
 * Nest turns multer's LIMIT_FILE_SIZE into a bare PayloadTooLargeException,
 * which AppExceptionFilter can only code as PAYLOAD_TOO_LARGE. Listing this
 * interceptor BEFORE FileInterceptor makes it the outer one, so it sees that
 * rejection and swaps in FILE_TOO_LARGE. The status is 413 either way.
 *
 * A fileFilter rejection needs no translation: transformException returns any
 * HttpException untouched, so the AppException it raises arrives intact.
 */
@Injectable()
export class UploadErrorInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof PayloadTooLargeException ? FileErrors.TOO_LARGE() : error,
        ),
      ),
    );
  }
}
