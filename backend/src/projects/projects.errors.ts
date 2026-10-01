import { HttpStatus } from '@nestjs/common';
import { defineErrors } from '../common/exceptions/domain-errors';

/**
 * NOT_FOUND is deliberately what a non-member gets, for a read or a write.
 * A 403 there would confirm the project exists, which is exactly the leak
 * membership scoping prevents. NOT_OWNER is only ever returned to somebody who
 * can already read the project, so it tells them nothing new.
 */
export const ProjectErrors = defineErrors('PROJECT', {
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Project not found',
  },
  NOT_OWNER: {
    status: HttpStatus.FORBIDDEN,
    message: 'Only the project owner can do that',
  },
  CODE_TAKEN: {
    status: HttpStatus.CONFLICT,
    message: 'Another project already uses this code',
  },
  INVALID_DATE_RANGE: {
    status: HttpStatus.BAD_REQUEST,
    message: 'End date must be on or after the start date',
  },
  ARCHIVED: {
    status: HttpStatus.CONFLICT,
    message: 'This project is archived',
  },
  MEMBER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'No Clarivo account uses this email address',
  },
  ALREADY_MEMBER: {
    status: HttpStatus.CONFLICT,
    message: 'This person is already a member of this project',
  },
  OWNER_NOT_REMOVABLE: {
    status: HttpStatus.CONFLICT,
    message: 'The project owner cannot be removed',
  },
});
