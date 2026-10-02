import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AiClient } from '../ai/ai.client';
import type { EnvironmentVariables } from '../config/env.validation';
import { ProjectsService } from '../projects/projects.service';
import { SummaryDto } from './ai-schemas';
import { KnowledgeBlock } from './knowledge-block.entity';
import { KnowledgeRef } from './knowledge-ref.entity';
import { ProjectDocument } from './project-document.entity';
import { assertProjectWritable } from './project-writable';

const SYSTEM =
  'You write a short project brief for a business analyst, in prose, covering five angles in ' +
  'this order and nothing else:\n' +
  '1. What this is\n2. Who it is for\n3. What is being built\n4. What constrains it\n' +
  '5. What is still unknown\n' +
  'One short paragraph per angle, each opening with its angle as a bold-free sentence subject. ' +
  'Say only what the material supports; where it says nothing, the fifth paragraph is where that ' +
  'belongs. Do not invent names, dates or numbers.\n' +
  'Reply as JSON: {"summary": "..."}.';

/**
 * The brief reads the WHOLE corpus at once — every digest, the project's own
 * fields, and the accepted blocks. That is deliberate: a brief assembled only
 * from the bullets could never say something the bullets do not, which is
 * exactly the cross-document synthesis a BA wants.
 *
 * The accepted cost is that it may state a fact no block states, which is why
 * it cites documents rather than blocks, and why it is exempt from QuoteGuard:
 * it is derived, not extracted, so there is no verbatim span to check. That
 * exemption is here, in code, and nowhere else.
 */
@Injectable()
export class BriefGenerator {
  private readonly strongModel: string;

  constructor(
    @InjectRepository(KnowledgeBlock)
    private readonly blocks: Repository<KnowledgeBlock>,
    @InjectRepository(ProjectDocument)
    private readonly documents: Repository<ProjectDocument>,
    private readonly projects: ProjectsService,
    private readonly ai: AiClient,
    private readonly dataSource: DataSource,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.strongModel = config.get('AI_MODEL_STRONG', { infer: true });
  }

  /**
   * Always a proposal, never a write: `update` superseding the live brief when
   * one exists, `add` when none does. The live brief stays on the page until a
   * human accepts the replacement.
   */
  async regenerate(projectId: string, viewerId: string): Promise<KnowledgeBlock> {
    const project = await this.projects.requireProject(projectId, viewerId);
    assertProjectWritable(project);

    const [documents, accepted] = await Promise.all([
      this.documents.find({ where: { projectId, status: 'ready' } }),
      this.blocks.find({ where: { projectId, state: 'accepted' } }),
    ]);

    const { summary } = await this.ai.complete({
      model: this.strongModel,
      system: SYSTEM,
      user: buildPrompt(project, documents, accepted),
      schema: SummaryDto,
    });

    const live = accepted.find((block) => block.section === 'overview');

    return this.dataSource.transaction(async (manager) => {
      const brief = await manager.save(
        manager.create(KnowledgeBlock, {
          projectId,
          section: 'overview',
          position: 0,
          statement: summary,
          confidence: 'implied',
          origin: 'ai',
          state: 'proposed',
          kind: live ? 'update' : 'add',
          supersedesId: live?.id ?? null,
          sourceDocumentId: null,
          createdBy: viewerId,
        }),
      );

      // Document-level citations with a null locator: the brief cites what it
      // read, and there is no span to point at.
      for (const document of documents) {
        await manager.save(
          manager.create(KnowledgeRef, {
            blockId: brief.id,
            documentId: document.id,
            locator: null,
            quote: document.title,
          }),
        );
      }

      return brief;
    });
  }
}

function buildPrompt(
  project: { name: string; domain: string; customerBu: string; objective: string | null },
  documents: ProjectDocument[],
  accepted: KnowledgeBlock[],
): string {
  const digests = documents
    .map((document) => `### ${document.title}\n${document.digest ?? '(no digest)'}`)
    .join('\n\n');

  const knowledge = accepted
    .filter((block) => block.section !== 'overview')
    .map((block) => `- [${block.section}] ${block.statement}`)
    .join('\n');

  return [
    `Project: ${project.name}`,
    `Customer / business unit: ${project.customerBu}`,
    `Domain: ${project.domain}`,
    `Objective: ${project.objective ?? '(not stated)'}`,
    '',
    documents.length
      ? `Documents read so far:\n\n${digests}`
      : 'No documents have been read yet — everything beyond the project fields is unknown.',
    '',
    knowledge ? `Accepted knowledge:\n${knowledge}` : 'The knowledge page has no accepted blocks.',
  ].join('\n');
}
