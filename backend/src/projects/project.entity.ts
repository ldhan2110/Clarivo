import { Check, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { User } from '../users/user.entity';

export type ProjectStatus = 'active' | 'archived';

/**
 * One project — the domain spine everything else hangs off. Access is never
 * expressed here: a `project_members` row is what makes a project visible, and
 * ProjectsService is the only place that resolves it.
 *
 * `status` is a varchar + CHECK rather than a Postgres enum type. Adding a
 * value to a pg enum needs ALTER TYPE ... ADD VALUE, which cannot run inside a
 * transaction block; a CHECK widens with a plain constraint swap.
 */
@Entity('projects')
@Check("status IN ('active','archived')")
export class Project extends BaseEntity {
  /** Human handle, e.g. `CLT-DevSpec`. Globally unique — one index, one message. */
  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Customer or business unit the project belongs to. */
  @Column({ name: 'customer_bu', type: 'varchar', length: 255 })
  customerBu: string;

  // ponytail: free text, no CHECK. `domain` is customer data that grows, so a
  // constraint here would turn every new vertical into a migration.
  @Column({ type: 'varchar', length: 255 })
  domain: string;

  @Column({ type: 'text', nullable: true })
  objective: string | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: ProjectStatus;

  /**
   * Typed `string`, not Date. TypeORM returns a `date` column as 'YYYY-MM-DD',
   * and that is what ships: wrapping it in a Date re-introduces a timezone and
   * can render a start date a day early for a viewer behind UTC.
   */
  @Column({ name: 'starts_on', type: 'date', nullable: true })
  startsOn: string | null;

  @Column({ name: 'ends_on', type: 'date', nullable: true })
  endsOn: string | null;

  // ponytail: no index. There is no per-creator listing and no user-delete
  // path, so the RESTRICT check never runs. Add @Index() when either ships.
  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  /** RESTRICT, the repo default: a user who created a project cannot vanish. */
  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'created_by' })
  creator: User;
}
