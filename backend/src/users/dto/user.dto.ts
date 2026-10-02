import { Expose } from 'class-transformer';
import { AuditDto } from '../../common/dtos/audit.dto';

/**
 * Response shape for a user. `passwordHash` is deliberately absent: without an
 * @Expose it cannot be serialised, which is what keeps the hash server-side.
 */
export class UserDto extends AuditDto {
  @Expose()
  email: string;

  @Expose()
  name: string;

  /** File id of the user's avatar, or null. The frontend builds the image URL
   *  from it; the bare id keeps the server ignorant of the frontend proxy path. */
  @Expose()
  avatarFileId: string | null;
}
