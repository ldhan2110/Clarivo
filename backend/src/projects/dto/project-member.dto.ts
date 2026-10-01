import { Expose } from 'class-transformer';
import type { ProjectRole } from '../project-member.entity';

/** One member row. Keyed by `userId`, not the membership row's own id. */
export class ProjectMemberDto {
  @Expose()
  userId: string;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  role: ProjectRole;
}
