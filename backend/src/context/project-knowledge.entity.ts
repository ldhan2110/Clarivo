import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { Project } from '../projects/project.entity';

/**
 * The single knowledge summary for a project — one markdown document (fixed `##`
 * sections, inline `Sources:` lines, and ```mermaid diagram blocks). One row per
 * project (UNIQUE project_id). AI generates it; a human may edit it directly,
 * which sets `edited` so a later Regenerate warns before overwriting their work.
 */
@Entity('project_knowledge')
@Unique(['projectId'])
export class ProjectKnowledge extends BaseEntity {
  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'summary_md', type: 'text', default: '' })
  summaryMd: string;

  @Column({ type: 'boolean', default: false })
  edited: boolean;

  @Column({ name: 'generated_at', type: 'timestamptz', nullable: true })
  generatedAt: Date | null;
}
