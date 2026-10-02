import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { KnowledgeBlock } from './knowledge-block.entity';
import { ProjectDocument } from './project-document.entity';

/**
 * One citation from a block back to a document. A table rather than a JSONB
 * column because all three reads are index lookups here and sequential scans
 * there: "which blocks cite document X", the membership join that authorises a
 * download, and orphan detection.
 */
@Entity('knowledge_refs')
export class KnowledgeRef extends BaseEntity {
  @Index()
  @Column({ name: 'block_id', type: 'uuid' })
  blockId: string;

  /** CASCADE: a citation has no meaning without its block and owns no bytes. */
  @ManyToOne(() => KnowledgeBlock, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'block_id' })
  block: KnowledgeBlock;

  // Powers "which blocks cite this document", asked before a document is archived.
  @Index()
  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @ManyToOne(() => ProjectDocument, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'document_id' })
  document: ProjectDocument;

  /**
   * Whatever the parser can honestly report: `p.12` for pdf, `§3.2` for
   * docx/md headings, `line 44` for txt. Null when it can locate nothing, and
   * null by rule for derived blocks (brief, diagrams), which cite a document
   * rather than a span.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  locator: string | null;

  /** Verbatim snippet from the source — what a reviewer checks the statement
   *  against, and what QuoteGuard verifies before the block is ever persisted. */
  @Column({ type: 'text' })
  quote: string;
}
