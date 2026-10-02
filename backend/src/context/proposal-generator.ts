import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AiClient } from '../ai/ai.client';
import type { EnvironmentVariables } from '../config/env.validation';
import { ProposalDto, ProposalsDto } from './ai-schemas';
import { KNOWLEDGE_SECTIONS, KnowledgeBlock } from './knowledge-block.entity';
import { KnowledgeRef } from './knowledge-ref.entity';
import type { ProjectDocument } from './project-document.entity';
import { applyQuoteGuard } from './quote-guard';

const SYSTEM =
  'You are a business analyst reading one project document and proposing changes to a shared ' +
  'knowledge page. You never write the page: a human accepts or rejects everything you propose.\n' +
  `Sections: ${KNOWLEDGE_SECTIONS.join(', ')}.\n` +
  'Rules:\n' +
  '- One assertion per proposal. No preamble, no summary of the document as a whole.\n' +
  '- Every proposal carries a "quote": a span copied VERBATIM from the document text. ' +
  'A quote you cannot copy exactly is a proposal you must not make.\n' +
  '- kind "add" for something the page does not say, with no supersedesId.\n' +
  '- kind "update" for an existing block this document states more precisely, with its id as supersedesId.\n' +
  '- kind "conflict" when this document CONTRADICTS an existing block, with its id as supersedesId. ' +
  'Do not choose a side — the disagreement is the finding.\n' +
  '- Blocks marked EDITED BY A HUMAN must never receive an "update". If you disagree with one, ' +
  'the only honest proposal is a "conflict".\n' +
  '- confidence: "stated" if the document says it outright, "implied" if you inferred it, ' +
  '"uncertain" if the document is ambiguous.\n' +
  'Reply as JSON: {"proposals": [{"kind","section","statement","confidence","supersedesId","quote","locator"}]}.';

/**
 * Turns a document's digest into proposals, then persists only what survives
 * the QuoteGuard. Nothing here ever touches an accepted block: the page changes
 * when a human accepts, not when a model speaks.
 */
@Injectable()
export class ProposalGenerator {
  private readonly logger = new Logger(ProposalGenerator.name);
  private readonly strongModel: string;

  constructor(
    @InjectRepository(KnowledgeBlock)
    private readonly blocks: Repository<KnowledgeBlock>,
    private readonly ai: AiClient,
    private readonly dataSource: DataSource,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.strongModel = config.get('AI_MODEL_STRONG', { infer: true });
  }

  async generate(
    document: ProjectDocument,
    digest: string,
    extractedText: string,
  ): Promise<KnowledgeBlock[]> {
    const existing = await this.blocks.find({
      where: { projectId: document.projectId, state: 'accepted' },
      order: { section: 'ASC', position: 'ASC' },
    });

    // A malformed response is retried once inside the client and then throws;
    // persistence happens strictly after, so a failed run writes nothing.
    const { proposals } = await this.ai.complete({
      model: this.strongModel,
      system: SYSTEM,
      user: this.buildPrompt(document, digest, existing),
      schema: ProposalsDto,
    });

    const resolved = proposals.map((proposal) => this.enforceEditedBlockRule(proposal, existing));
    const { kept, dropped } = applyQuoteGuard(resolved, extractedText);
    if (dropped > 0) {
      this.logger.warn(
        `QuoteGuard dropped ${dropped}/${proposals.length} proposals for document ${document.id}`,
      );
    }

    return this.persist(document, kept, existing);
  }

  /**
   * The second of the two places this rule is enforced. The prompt excludes
   * human-edited blocks from the update path; this rejects one the model
   * proposed anyway, because that single property is what makes the fifth and
   * tenth upload safe for a BA who has corrected the page by hand.
   */
  private enforceEditedBlockRule(
    proposal: ProposalDto,
    existing: KnowledgeBlock[],
  ): ProposalDto {
    if (proposal.kind !== 'update' || !proposal.supersedesId) return proposal;

    const target = existing.find((block) => block.id === proposal.supersedesId);
    if (!target?.editedAt) return proposal;

    this.logger.log(`Converted an update targeting human-edited block ${target.id} to a conflict`);
    // Assigned onto a fresh instance rather than spread: ProposalDto is a
    // class, and a spread would drop its prototype along with its decorators.
    return Object.assign(new ProposalDto(), proposal, { kind: 'conflict' as const });
  }

  /** One transaction: a half-written run would show a block with no citation. */
  private async persist(
    document: ProjectDocument,
    proposals: ProposalDto[],
    existing: KnowledgeBlock[],
  ): Promise<KnowledgeBlock[]> {
    const usable = proposals.filter((proposal) => this.hasValidTarget(proposal, existing));
    if (usable.length === 0) return [];

    return this.dataSource.transaction(async (manager) => {
      const saved: KnowledgeBlock[] = [];

      for (const proposal of usable) {
        const block = await manager.save(
          manager.create(KnowledgeBlock, {
            projectId: document.projectId,
            section: proposal.section,
            statement: proposal.statement,
            confidence: proposal.confidence,
            origin: 'ai',
            state: 'proposed',
            kind: proposal.kind,
            supersedesId: proposal.kind === 'add' ? null : (proposal.supersedesId ?? null),
            sourceDocumentId: document.id,
            createdBy: document.uploadedBy,
          }),
        );
        await manager.save(
          manager.create(KnowledgeRef, {
            blockId: block.id,
            documentId: document.id,
            locator: proposal.locator ?? null,
            quote: proposal.quote,
          }),
        );
        saved.push(block);
      }

      return saved;
    });
  }

  /** The CHECK constraint would reject these anyway; dropping them is kinder
   *  than failing the whole run over one hallucinated block id. */
  private hasValidTarget(proposal: ProposalDto, existing: KnowledgeBlock[]): boolean {
    if (proposal.kind === 'add') return true;
    const target = existing.find((block) => block.id === proposal.supersedesId);
    if (!target) {
      this.logger.warn(`Dropped a ${proposal.kind} targeting unknown block ${proposal.supersedesId}`);
      return false;
    }
    return true;
  }

  private buildPrompt(
    document: ProjectDocument,
    digest: string,
    existing: KnowledgeBlock[],
  ): string {
    const page =
      existing.length === 0
        ? 'The knowledge page is empty. Every finding is an "add".'
        : existing
            .map(
              (block) =>
                `- id=${block.id} [${block.section}]${block.editedAt ? ' EDITED BY A HUMAN — conflict only, never update' : ''}: ${block.statement}`,
            )
            .join('\n');

    return [
      `Document: ${document.title}`,
      '',
      'Digest of this document:',
      digest,
      '',
      'Current accepted knowledge page:',
      page,
    ].join('\n');
  }
}
