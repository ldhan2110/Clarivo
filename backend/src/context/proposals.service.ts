import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { ContextErrors } from './context.errors';
import type {
  KnowledgeBlockDto,
  ProposalGroupDto,
  ProposalItemDto,
  ResolveConflictDto,
} from './dto/knowledge.dto';
import { KnowledgeBlock } from './knowledge-block.entity';
import { KnowledgeRef } from './knowledge-ref.entity';
import { ProjectDocument } from './project-document.entity';
import { assertProjectWritable } from './project-writable';

/**
 * The review queue. Nothing here ever deletes a row: a rejected proposal and a
 * superseded block are both kept with their sources, because the disagreement
 * between two documents is the most valuable thing a second document produces.
 */
@Injectable()
export class ProposalsService {
  constructor(
    @InjectRepository(KnowledgeBlock)
    private readonly blocks: Repository<KnowledgeBlock>,
    @InjectRepository(KnowledgeRef)
    private readonly refs: Repository<KnowledgeRef>,
    @InjectRepository(ProjectDocument)
    private readonly documents: Repository<ProjectDocument>,
    private readonly projects: ProjectsService,
    private readonly dataSource: DataSource,
  ) {}

  /** Proposals grouped by the document whose propose run produced them. */
  async list(projectId: string, viewerId: string): Promise<ProposalGroupDto[]> {
    await this.projects.requireMembership(projectId, viewerId);

    const proposals = await this.blocks.find({
      where: { projectId, state: 'proposed' },
      order: { createdAt: 'ASC' },
    });
    if (proposals.length === 0) return [];

    const targets = await this.loadTargets(proposals);
    const refs = await this.loadRefs([...proposals, ...targets.values()].map((b) => b.id));
    // Every cited document, not just the source ones — a brief cites several.
    const documents = await this.loadDocuments(proposals, [...refs.values()].flat());

    const groups = new Map<string, ProposalGroupDto>();
    for (const proposal of proposals) {
      const documentId = proposal.sourceDocumentId ?? 'manual';
      const group = groups.get(documentId) ?? {
        documentId,
        // The only proposal with no source document is the project brief: it
        // is derived from every digest at once rather than extracted from one.
        documentTitle: documents.get(documentId)?.title ?? 'Project brief',
        proposals: [],
      };
      const target = proposal.supersedesId
        ? (targets.get(proposal.supersedesId) ?? null)
        : null;
      group.proposals.push(
        toBlockDto(proposal, refs.get(proposal.id) ?? [], documents, {
          target: target ? toBlockDto(target, refs.get(target.id) ?? [], documents) : null,
        }),
      );
      groups.set(documentId, group);
    }

    return [...groups.values()];
  }

  /**
   * add      → accepted
   * update   → accepted, target superseded
   * conflict → one of three outcomes, all of which keep both sources
   *
   * Every state change lands in one transaction: a half-applied accept would
   * leave two live blocks saying opposite things.
   */
  async accept(
    projectId: string,
    blockId: string,
    viewerId: string,
    dto: ResolveConflictDto = {},
  ): Promise<KnowledgeBlock> {
    assertProjectWritable(await this.projects.requireProject(projectId, viewerId));
    const proposal = await this.loadProposal(projectId, blockId);

    if (proposal.kind === 'conflict') return this.resolveConflict(proposal, dto, viewerId);

    return this.dataSource.transaction(async (manager) => {
      if (proposal.kind === 'update' && proposal.supersedesId) {
        await manager.update(KnowledgeBlock, proposal.supersedesId, { state: 'superseded' });
      }
      return this.setState(manager, proposal, 'accepted');
    });
  }

  /** Rejected, never deleted — the row and its citations stay readable. */
  async reject(projectId: string, blockId: string, viewerId: string): Promise<KnowledgeBlock> {
    assertProjectWritable(await this.projects.requireProject(projectId, viewerId));
    const proposal = await this.loadProposal(projectId, blockId);

    return this.dataSource.transaction((manager) => this.setState(manager, proposal, 'rejected'));
  }

  private async resolveConflict(
    proposal: KnowledgeBlock,
    dto: ResolveConflictDto,
    viewerId: string,
  ): Promise<KnowledgeBlock> {
    if (!dto.resolution) throw ContextErrors.CONFLICT_RESOLUTION_REQUIRED({ id: proposal.id });
    if (dto.resolution === 'write_own' && !dto.statement?.trim()) {
      throw ContextErrors.CONFLICT_RESOLUTION_REQUIRED({ id: proposal.id, reason: 'statement' });
    }

    return this.dataSource.transaction(async (manager) => {
      // Keep existing: the proposal loses, and stays on record with its source.
      if (dto.resolution === 'keep_existing') {
        return this.setState(manager, proposal, 'rejected');
      }

      // Use new: the proposal wins, the target becomes history.
      if (dto.resolution === 'use_new') {
        await manager.update(KnowledgeBlock, proposal.supersedesId!, { state: 'superseded' });
        return this.setState(manager, proposal, 'accepted');
      }

      // Write my own: neither side's wording survives, but both sources do.
      const written = await manager.save(
        manager.create(KnowledgeBlock, {
          projectId: proposal.projectId,
          section: proposal.section,
          position: proposal.position,
          statement: dto.statement!.trim(),
          confidence: proposal.confidence,
          origin: 'human',
          state: 'accepted',
          kind: 'update',
          supersedesId: proposal.supersedesId,
          sourceDocumentId: null,
          editedAt: new Date(),
          createdBy: viewerId,
        }),
      );
      await manager.update(KnowledgeBlock, proposal.supersedesId!, { state: 'superseded' });
      await this.setState(manager, proposal, 'rejected');
      return written;
    });
  }

  private async setState(
    manager: EntityManager,
    proposal: KnowledgeBlock,
    state: KnowledgeBlock['state'],
  ): Promise<KnowledgeBlock> {
    await manager.update(KnowledgeBlock, proposal.id, { state });
    proposal.state = state;
    return proposal;
  }

  /** 409 rather than a silent no-op: two reviewers must not both think they won. */
  private async loadProposal(projectId: string, blockId: string): Promise<KnowledgeBlock> {
    const block = await this.blocks.findOne({ where: { id: blockId, projectId } });
    if (!block) throw ContextErrors.BLOCK_NOT_FOUND({ id: blockId });
    if (block.state !== 'proposed') {
      throw ContextErrors.PROPOSAL_ALREADY_RESOLVED({ id: blockId, state: block.state });
    }
    return block;
  }

  private async loadTargets(proposals: KnowledgeBlock[]): Promise<Map<string, KnowledgeBlock>> {
    const ids = proposals.map((p) => p.supersedesId).filter((id): id is string => !!id);
    if (ids.length === 0) return new Map();
    const targets = await this.blocks.find({ where: { id: In(ids) } });
    return new Map(targets.map((target) => [target.id, target]));
  }

  /** Keyed by id: the group heading needs the title, a citation chip needs the
   *  file id to link a download. */
  private async loadDocuments(
    proposals: KnowledgeBlock[],
    refs: KnowledgeRef[],
  ): Promise<Map<string, ProjectDocument>> {
    const ids = [
      ...new Set([
        ...proposals.map((p) => p.sourceDocumentId).filter((id): id is string => !!id),
        ...refs.map((ref) => ref.documentId),
      ]),
    ];
    if (ids.length === 0) return new Map();
    const documents = await this.documents.find({ where: { id: In(ids) } });
    return new Map(documents.map((document) => [document.id, document]));
  }

  private async loadRefs(blockIds: string[]): Promise<Map<string, KnowledgeRef[]>> {
    const refs = await this.refs.find({ where: { blockId: In(blockIds) } });
    const byBlock = new Map<string, KnowledgeRef[]>();
    for (const ref of refs) {
      byBlock.set(ref.blockId, [...(byBlock.get(ref.blockId) ?? []), ref]);
    }
    return byBlock;
  }
}

/** Explicit field-by-field, never a spread: KnowledgeBlock is an entity class
 *  and spreading it would carry its relations and lose its prototype. */
function toBlockDto(
  block: KnowledgeBlock,
  refs: KnowledgeRef[],
  documents: Map<string, ProjectDocument>,
  extra: { target: KnowledgeBlockDto | null } = { target: null },
): ProposalItemDto {
  return {
    id: block.id,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    section: block.section,
    position: block.position,
    statement: block.statement,
    confidence: block.confidence,
    origin: block.origin,
    state: block.state,
    kind: block.kind,
    supersedesId: block.supersedesId,
    sourceDocumentId: block.sourceDocumentId,
    editedAt: block.editedAt,
    authorName: null,
    refs: refs.map((ref) => ({
      id: ref.id,
      documentId: ref.documentId,
      title: documents.get(ref.documentId)?.title ?? 'Unknown document',
      fileId: documents.get(ref.documentId)?.fileId ?? '',
      locator: ref.locator,
      quote: ref.quote,
    })),
    target: extra.target,
  };
}
