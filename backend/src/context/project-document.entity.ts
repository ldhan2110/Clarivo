import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { Project } from '../projects/project.entity';
import { FileEntity } from '../files/file.entity';
import { User } from '../users/user.entity';

export type DocumentSourceType = 'doc' | 'web';
export type DocumentStatus = 'new' | 'processing' | 'processed' | 'failed';

/**
 * One context source for a project: either an uploaded document (`source_type`
 * 'doc', backed by a `files` row) or a web page found by customer research
 * (`source_type` 'web', carrying its URL). Both feed the single project summary.
 *
 * A source sits `new` until the one "Process all" run reads it, when it walks
 * `new → processing → processed` (or `failed` with a readable reason). The
 * extracted text is cached on the row so a later Regenerate need not re-parse a
 * large PDF or re-hit the web — that is a parse cache, not retrieval.
 */
@Entity('project_documents')
@Index(['projectId'])
@Check("source_type IN ('doc','web')")
@Check("status IN ('new','processing','processed','failed')")
// A source is a document XOR a web page: exactly one of file_id / url is set.
@Check(
  "(source_type = 'doc' AND file_id IS NOT NULL AND url IS NULL) OR " +
    "(source_type = 'web' AND file_id IS NULL AND url IS NOT NULL)",
)
export class ProjectDocument extends BaseEntity {
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  /**
   * CASCADE — a source has no meaning outside its project and owns no bytes a FK
   * can't reach (the `files` row it points at stays RESTRICT, below). Deleting a
   * project removes its documents and summary but never a file row or disk byte.
   */
  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'source_type', type: 'varchar', length: 8 })
  sourceType: DocumentSourceType;

  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  fileId: string | null;

  /** RESTRICT — the file owns bytes on disk no FK can clean up. */
  @ManyToOne(() => FileEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'file_id' })
  file: FileEntity | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  url: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  /** Parsed document text or fetched web extract — the parse cache. */
  @Column({ name: 'extracted_text', type: 'text', nullable: true })
  extractedText: string | null;

  @Column({ type: 'varchar', length: 16, default: 'new' })
  status: DocumentStatus;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedByUser: User;
}
