import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';
import { ContextErrors } from './context.errors';
import type {
  CitationDto,
  CreateBlockDto,
  KnowledgeBlockDto,
  KnowledgePageDto,
  UpdateBlockDto,
} from './dto/knowledge.dto';
import { KNOWLEDGE_SECTIONS, KnowledgeBlock } from './knowledge-block.entity';
import { KnowledgeRef } from './knowledge-ref.entity';
import { ProjectDocument } from './project-document.entity';
import { assertProjectWritable } from './project-writable';

/**
 * The page itself: accepted blocks only, always all nine sections. An empty
 * section is returned rather than hidden — the gap is the signal that becomes
 * a discovery question, so dropping it would hide the most useful thing here.
 */
@Injectable()
export class KnowledgeService {
  constructor(
    @InjectRepository(KnowledgeBlock)
    private readonly blocks: Repository<KnowledgeBlock>,
    @InjectRepository(KnowledgeRef)
    private readonly refs: Repository<KnowledgeRef>,
    @InjectRepository(ProjectDocument)
    private readonly documents: Repository<ProjectDocument>,
    private readonly projects: ProjectsService,
    private readonly users: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  async getPage(projectId: string, viewerId: string): Promise<KnowledgePageDto> {
    await this.projects.requireMembership(projectId, viewerId);

    const blocks = await this.blocks.find({
      where: { projectId, state: 'accepted' },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    const dtos = await this.toDtos(blocks);

    return {
      sections: KNOWLEDGE_SECTIONS.map((section) => ({
        section,
        blocks: dtos.filter((block) => block.section === section),
      })),
      briefStaleCount: await this.briefStaleCount(projectId, blocks),
    };
  }

  /** Documents that became ready after the live brief was written. Counted,
   *  never acted on: auto-regeneration would churn prose the BA just fixed. */
  private async briefStaleCount(
    projectId: string,
    accepted: KnowledgeBlock[],
  ): Promise<number> {
    const brief = accepted.find((block) => block.section === 'overview');
    if (!brief) return 0;

    return this.documents
      .createQueryBuilder('document')
      .where('document.project_id = :projectId', { projectId })
      .andWhere('document.status = :status', { status: 'ready' })
      .andWhere('document.updated_at > :writtenAt', { writtenAt: brief.createdAt })
      .getCount();
  }

  async createBlock(
    projectId: string,
    dto: CreateBlockDto,
    viewerId: string,
  ): Promise<KnowledgeBlockDto> {
    assertProjectWritable(await this.projects.requireProject(projectId, viewerId));

    const block = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(KnowledgeBlock, {
          projectId,
          section: dto.section,
          statement: dto.statement,
          confidence: dto.confidence,
          // A human block is the page, not a proposal about it.
          origin: 'human',
          state: 'accepted',
          kind: 'add',
          supersedesId: null,
          sourceDocumentId: null,
          createdBy: viewerId,
        }),
      );
      await this.writeRefs(manager, created.id, dto.refs ?? []);
      return created;
    });

    const [result] = await this.toDtos([block]);
    return result;
  }

  /**
   * Sets `edited_at`. That single column is what makes every later upload safe:
   * from here on no document can produce an `update` against this block, only a
   * `conflict` a human has to resolve.
   */
  async updateBlock(
    projectId: string,
    blockId: string,
    dto: UpdateBlockDto,
    viewerId: string,
  ): Promise<KnowledgeBlockDto> {
    assertProjectWritable(await this.projects.requireProject(projectId, viewerId));
    const block = await this.loadBlock(projectId, blockId);

    const updated = await this.dataSource.transaction(async (manager) => {
      if (dto.statement !== undefined) block.statement = dto.statement;
      if (dto.confidence !== undefined) block.confidence = dto.confidence;
      block.editedAt = new Date();
      const saved = await manager.save(KnowledgeBlock, block);

      if (dto.refs) {
        await manager.delete(KnowledgeRef, { blockId });
        await this.writeRefs(manager, blockId, dto.refs);
      }
      return saved;
    });

    const [result] = await this.toDtos([updated]);
    return result;
  }

  /**
   * The one hard delete in this change, and it is a row the user created. Its
   * refs go with it through the FK CASCADE; documents are never deleted, so no
   * citation anywhere else is stranded.
   */
  async deleteBlock(projectId: string, blockId: string, viewerId: string): Promise<void> {
    assertProjectWritable(await this.projects.requireProject(projectId, viewerId));
    const block = await this.loadBlock(projectId, blockId);
    await this.blocks.remove(block);
  }

  private async writeRefs(
    manager: { create: Function; save: Function },
    blockId: string,
    refs: CitationDto[],
  ): Promise<void> {
    for (const ref of refs) {
      await manager.save(
        manager.create(KnowledgeRef, {
          blockId,
          documentId: ref.documentId,
          locator: ref.locator ?? null,
          quote: ref.quote,
        }),
      );
    }
  }

  private async loadBlock(projectId: string, blockId: string): Promise<KnowledgeBlock> {
    const block = await this.blocks.findOne({ where: { id: blockId, projectId } });
    if (!block) throw ContextErrors.BLOCK_NOT_FOUND({ id: blockId });
    return block;
  }

  /** Each ref carries the document title and file id so a chip can download it. */
  private async toDtos(blocks: KnowledgeBlock[]): Promise<KnowledgeBlockDto[]> {
    if (blocks.length === 0) return [];

    const refs = await this.refs.find({ where: { blockId: In(blocks.map((b) => b.id)) } });
    const documentIds = [...new Set(refs.map((ref) => ref.documentId))];
    const documents = documentIds.length
      ? await this.documents.find({ where: { id: In(documentIds) } })
      : [];
    const byDocument = new Map(documents.map((document) => [document.id, document]));

    const authorIds = [...new Set(blocks.filter((b) => b.origin === 'human').map((b) => b.createdBy))];
    const authors = new Map<string, string>();
    for (const id of authorIds) {
      const user = await this.users.findById(id).catch(() => null);
      if (user) authors.set(id, user.name);
    }

    return blocks.map((block) => ({
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
      authorName: block.origin === 'human' ? (authors.get(block.createdBy) ?? null) : null,
      refs: refs
        .filter((ref) => ref.blockId === block.id)
        .map((ref) => ({
          id: ref.id,
          documentId: ref.documentId,
          title: byDocument.get(ref.documentId)?.title ?? 'Unknown document',
          fileId: byDocument.get(ref.documentId)?.fileId ?? '',
          locator: ref.locator,
          quote: ref.quote,
        })),
    }));
  }
}
