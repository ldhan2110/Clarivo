import { Check, Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { Project } from './project.entity';
import { User } from '../users/user.entity';

export type ProjectRole = 'owner' | 'member';

/**
 * One person's membership of one project. This row is the access grant: the
 * list query starts FROM this table and joins outward, so a project the viewer
 * has no row for can never enter the candidate set.
 */
@Entity('project_members')
@Unique(['projectId', 'userId'])
@Index(['userId'])
@Check("role IN ('owner','member')")
export class ProjectMember extends BaseEntity {
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  /**
   * CASCADE — the one documented exception to the repo's RESTRICT default. A
   * membership row has no meaning without its project and owns no external
   * bytes, so cascading cannot orphan anything a FK can't reach (which is
   * exactly why files.uploaded_by stays RESTRICT).
   */
  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  // The hot lookup: every list query asks "which projects is this user in".
  // The composite unique leads with project_id, so it does not serve this.
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 16 })
  role: ProjectRole;
}
