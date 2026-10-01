import { Expose } from 'class-transformer';
import { AuditDto } from '../../common/dtos/audit.dto';
import type { ProjectRole } from '../project-member.entity';
import type { ProjectStatus } from '../project.entity';

/**
 * List row. Separate from ProjectDto on purpose: the list renders an avatar
 * stack and no prose, so it never joins or serialises `objective`, the dates
 * or the creator's name. `createdBy` has no @Expose here either.
 */
export class ProjectSummaryDto extends AuditDto {
  @Expose()
  code: string;

  @Expose()
  name: string;

  @Expose()
  customerBu: string;

  @Expose()
  domain: string;

  @Expose()
  status: ProjectStatus;

  @Expose()
  memberCount: number;

  /** At most three, owner first. `memberCount - memberNames.length` is the +N chip. */
  @Expose()
  memberNames: string[];

  @Expose()
  viewerRole: ProjectRole;
}
