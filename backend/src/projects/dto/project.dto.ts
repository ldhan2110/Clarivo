import { Expose } from 'class-transformer';
import { AuditDto } from '../../common/dtos/audit.dto';
import type { ProjectRole } from '../project-member.entity';
import type { ProjectStatus } from '../project.entity';

/**
 * Detail response. `createdBy` (the uuid) is deliberately absent: without an
 * @Expose it cannot be serialised, which keeps the creator's id server-side.
 * `createdByName` carries the display string the detail view actually renders.
 */
export class ProjectDto extends AuditDto {
  @Expose()
  code: string;

  @Expose()
  name: string;

  @Expose()
  customerBu: string;

  @Expose()
  domain: string;

  @Expose()
  objective: string | null;

  @Expose()
  status: ProjectStatus;

  /** `'YYYY-MM-DD'`, not a Date — wrapping it would re-introduce a timezone. */
  @Expose()
  startsOn: string | null;

  @Expose()
  endsOn: string | null;

  @Expose()
  memberCount: number;

  @Expose()
  createdByName: string;

  @Expose()
  viewerRole: ProjectRole;
}
