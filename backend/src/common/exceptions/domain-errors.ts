import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';

export interface ErrorDef {
  status: HttpStatus;
  message: string;
}

export type DomainErrors<T> = {
  [K in keyof T]: (details?: unknown) => AppException;
};

/**
 * Declare one domain's errors in one place.
 *
 *   export const ProjectErrors = defineErrors('PROJECT', {
 *     NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Project not found' },
 *   });
 *   throw ProjectErrors.NOT_FOUND({ id });   // code: PROJECT_NOT_FOUND
 */
export function defineErrors<T extends Record<string, ErrorDef>>(
  domain: string,
  defs: T,
): DomainErrors<T> {
  return Object.fromEntries(
    Object.entries(defs).map(([key, def]) => [
      key,
      (details?: unknown) =>
        new AppException(`${domain}_${key}`, def.message, def.status, details),
    ]),
  ) as DomainErrors<T>;
}
