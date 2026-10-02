import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { FileEntity } from '../files/file.entity';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';

export type DocumentStatus =
  | 'pending'
  | 'parsing'
  | 'summarizing'
  | 'proposing'
  | 'ready'
  | 'failed'
  | 'archived';

/** The statuses the pipeline still owns — anything else is settled. */
export const NON_TERMINAL_STATUSES: DocumentStatus[] = [
  'pending',
  'parsing',
  'summarizing',
  'proposing',
];

/**
 * One uploaded context document. It does NOT own the bytes — `files` does, and
 * `file_id` is RESTRICT — so cascading a project away removes this row but
 * leaves the file row and the bytes on disk reachable.
 *
 * Extracted text is deliberately not stored: the bytes are on disk and
 * re-parsing is free. Only `digest` costs money, so only `digest` is persisted.
 */
@Entity('project_documents')
@Check(
  "status IN ('pending','parsing','summarizing','proposing','ready','failed','archived')",
)
export class ProjectDocument extends BaseEntity {
  // Every query starts "documents of this project".
  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  /** CASCADE: a context document has no meaning outside its project, and owns
   *  no bytes of its own — `file_id` below is RESTRICT, so nothing is orphaned. */
  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  /** UNIQUE: one stored file backs at most one document row. */
  @Column({ name: 'file_id', type: 'uuid', unique: true })
  fileId: string;

  @ManyToOne(() => FileEntity, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'file_id' })
  file: FileEntity;

  /** Seeded from files.original_name, renameable afterwards. */
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: DocumentStatus;

  /** Failure reason, shown in the UI. Null unless status is 'failed'. */
  @Column({ type: 'text', nullable: true })
  error: string | null;

  // ponytail: int, not bigint — TypeORM returns bigint as a JS string. A
  // ~2GB ceiling on a character count is 21x the 100MB file cap.
  @Column({ name: 'char_count', type: 'int', nullable: true })
  charCount: number | null;

  /** The map-reduce summary. The expensive artifact, stored so a re-propose
   *  costs no map pass and no re-parse. */
  @Column({ type: 'text', nullable: true })
  digest: string | null;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User;
}
