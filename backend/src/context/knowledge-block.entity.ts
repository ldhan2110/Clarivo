import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';
import { ProjectDocument } from './project-document.entity';

export type KnowledgeSection =
  | 'overview'
  | 'scope'
  | 'stakeholders'
  | 'process'
  | 'data_model'
  | 'constraints'
  | 'integrations'
  | 'glossary'
  | 'open_questions';

/** Fixed render order. The page shows every section, including empty ones. */
export const KNOWLEDGE_SECTIONS: KnowledgeSection[] = [
  'overview',
  'scope',
  'stakeholders',
  'process',
  'data_model',
  'constraints',
  'integrations',
  'glossary',
  'open_questions',
];

export type KnowledgeConfidence = 'stated' | 'implied' | 'uncertain';
export type KnowledgeOrigin = 'ai' | 'human';
export type KnowledgeState = 'proposed' | 'accepted' | 'rejected' | 'superseded';
export type KnowledgeKind = 'add' | 'update' | 'conflict';

/**
 * One assertion on the knowledge page — and, discriminated by `state`, also the
 * proposal queue and the history. A separate proposals table plus an audit
 * table would hold the same rows in three shapes.
 *
 *   proposed    in the review queue, invisible on the page
 *   accepted    on the page now
 *   rejected    a human said no; kept with its source so the disagreement survives
 *   superseded  replaced by something a human accepted; kept as history
 *
 * A diagram is not a type: it is a block whose `statement` carries a ```mermaid
 * fence. Same edit, supersede and citation flow, zero schema cost.
 */
@Entity('knowledge_blocks')
@Index(['projectId', 'state'])
@Check(
  "section IN ('overview','scope','stakeholders','process','data_model','constraints','integrations','glossary','open_questions')",
)
@Check("confidence IN ('stated','implied','uncertain')")
@Check("origin IN ('ai','human')")
@Check("state IN ('proposed','accepted','rejected','superseded')")
@Check("kind IN ('add','update','conflict')")
// An update or conflict with no target is meaningless, and a server bug that
// produced one would otherwise be invisible.
@Check(
  "(kind = 'add' AND supersedes_id IS NULL) OR (kind <> 'add' AND supersedes_id IS NOT NULL)",
)
export class KnowledgeBlock extends BaseEntity {
  // The composite index (project_id, state) below covers this column; both the
  // page query and the review query filter on exactly that pair.
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  /** CASCADE, under the same test as project_members: no external bytes, no
   *  meaning without the parent. */
  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar', length: 16 })
  section: KnowledgeSection;

  /** Order within a section. */
  @Column({ type: 'int', default: 0 })
  position: number;

  /** Markdown, one assertion. */
  @Column({ type: 'text' })
  statement: string;

  @Column({ type: 'varchar', length: 16 })
  confidence: KnowledgeConfidence;

  @Column({ type: 'varchar', length: 8 })
  origin: KnowledgeOrigin;

  @Column({ type: 'varchar', length: 16, default: 'proposed' })
  state: KnowledgeState;

  /** What this row proposes to do to `supersedes_id`. */
  @Column({ type: 'varchar', length: 8, default: 'add' })
  kind: KnowledgeKind;

  /** The block this one replaces (update) or disagrees with (conflict).
   *  RESTRICT: history must not disappear underneath a chain. */
  @Column({ name: 'supersedes_id', type: 'uuid', nullable: true })
  supersedesId: string | null;

  @ManyToOne(() => KnowledgeBlock, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'supersedes_id' })
  supersedes: KnowledgeBlock | null;

  /** Which document's propose run produced it. Null for a human-authored block. */
  @Column({ name: 'source_document_id', type: 'uuid', nullable: true })
  sourceDocumentId: string | null;

  @ManyToOne(() => ProjectDocument, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'source_document_id' })
  sourceDocument: ProjectDocument | null;

  /**
   * Set when a human edits the statement. A block with edited_at set can only
   * ever receive a conflict, never an update — the single property that makes
   * the second, fifth and tenth upload safe for a BA who has corrected the page.
   */
  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'created_by' })
  creator: User;
}
