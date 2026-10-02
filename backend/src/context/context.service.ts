import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Not, Repository } from 'typeorm';
import { FilesService, type UploadedFile } from '../files/files.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectDocumentDto } from './dto/project-document.dto';
import { ContextErrors } from './context.errors';
import { ContextPipeline } from './context.pipeline';
import { KnowledgeBlock } from './knowledge-block.entity';
import { NON_TERMINAL_STATUSES, ProjectDocument } from './project-document.entity';
import { assertProjectWritable } from './project-writable';

/**
 * How long a document may sit mid-pipeline before the boot sweep calls it dead.
 * The pipeline is in-process, so a restart strands whatever was in flight;
 * without this, those rows never resolve and the UI polls forever.
 */
export const STALE_AFTER_MS = 30 * 60 * 1000;

@Injectable()
export class ContextService implements OnModuleInit {
  private readonly logger = new Logger(ContextService.name);

  constructor(
    @InjectRepository(ProjectDocument)
    private readonly documents: Repository<ProjectDocument>,
    @InjectRepository(KnowledgeBlock)
    private readonly blocks: Repository<KnowledgeBlock>,
    private readonly files: FilesService,
    private readonly projects: ProjectsService,
    private readonly pipeline: ContextPipeline,
  ) {}

  /**
   * The one writability gate, applied to every context write. The UI renders
   * these controls disabled on an archived project; this makes the API agree
   * independently, so the UI is never the only thing enforcing it.
   */
  async assertWritable(projectId: string, viewerId: string): Promise<void> {
    // requireProject runs the membership gate first, so a non-member still gets
    // 404 rather than learning the project is archived.
    assertProjectWritable(await this.projects.requireProject(projectId, viewerId));
  }

  /** Rename only. A document's file, project and history are never reassigned. */
  async renameDocument(
    projectId: string,
    documentId: string,
    title: string,
    viewerId: string,
  ): Promise<ProjectDocument> {
    await this.assertWritable(projectId, viewerId);
    const document = await this.findDocument(projectId, documentId, viewerId);
    document.title = title;
    return this.documents.save(document);
  }

  /**
   * Discards this document's still-proposed blocks and proposes again from the
   * stored digest — no re-parse, no map cost. Accepted blocks are untouched:
   * re-reading a document must never undo a decision a human made.
   */
  async rereadDocument(
    projectId: string,
    documentId: string,
    viewerId: string,
  ): Promise<ProjectDocument> {
    await this.assertWritable(projectId, viewerId);
    const document = await this.findDocument(projectId, documentId, viewerId);

    await this.blocks.delete({ sourceDocumentId: document.id, state: 'proposed' });
    void this.pipeline.repropose(document.id);
    return document;
  }

  /**
   * Sets the document aside. Its blocks and citations stay, and stay
   * downloadable — an archived document is still the evidence behind every
   * statement that cites it. Idempotent, and there is no delete anywhere.
   */
  async archiveDocument(
    projectId: string,
    documentId: string,
    viewerId: string,
  ): Promise<ProjectDocument> {
    await this.assertWritable(projectId, viewerId);
    const document = await this.findDocument(projectId, documentId, viewerId);
    if (document.status === 'archived') return document;

    document.status = 'archived';
    return this.documents.save(document);
  }

  /**
   * A restart kills every in-flight pipeline run. Anything still non-terminal
   * after STALE_AFTER_MS is therefore a zombie: fail it readably so the member
   * can re-run it, rather than leaving a row that polls forever.
   */
  async onModuleInit(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    const { affected } = await this.documents.update(
      { status: In(NON_TERMINAL_STATUSES), updatedAt: LessThan(cutoff) },
      {
        status: 'failed',
        error: 'Reading this document was interrupted by a server restart. Try reading it again.',
      },
    );
    if (affected) this.logger.warn(`Failed ${affected} document(s) stranded by a restart`);
  }

  /**
   * Bytes first through FilesService, then the document row. The response
   * returns immediately at `pending`; the controller starts the pipeline after
   * it, so an upload never waits on a model call.
   */
  async uploadDocument(
    projectId: string,
    file: UploadedFile,
    viewerId: string,
  ): Promise<ProjectDocument> {
    await this.assertWritable(projectId, viewerId);

    const stored = await this.files.store(file, viewerId);
    const document = await this.documents.save(
      this.documents.create({
        projectId,
        fileId: stored.id,
        // Seeded from the uploaded name; renameable afterwards.
        title: stored.originalName,
        status: 'pending',
        uploadedBy: viewerId,
      }),
    );

    // Attach the file we just stored rather than re-reading it: without this
    // the 201 body would report an empty mimeType and a zero size until the
    // first poll replaced it.
    document.file = stored;
    return document;
  }

  /** Active documents, newest first, each with its accepted-block count. */
  async listDocuments(projectId: string, viewerId: string): Promise<ProjectDocumentDto[]> {
    await this.projects.requireMembership(projectId, viewerId);

    const documents = await this.documents.find({
      where: { projectId, status: Not('archived') },
      relations: { file: true },
      order: { createdAt: 'DESC' },
    });

    return this.toDtos(documents);
  }

  /** One document by id, membership-gated. Resolvable even when archived. */
  async findDocument(
    projectId: string,
    documentId: string,
    viewerId: string,
  ): Promise<ProjectDocument> {
    await this.projects.requireMembership(projectId, viewerId);
    const document = await this.documents.findOne({
      where: { id: documentId, projectId },
      relations: { file: true },
    });
    if (!document) throw ContextErrors.DOCUMENT_NOT_FOUND({ id: documentId });
    return document;
  }

  async toDto(document: ProjectDocument): Promise<ProjectDocumentDto> {
    const [dto] = await this.toDtos([document]);
    return dto;
  }

  /** One count query for the whole list rather than one per row. */
  private async toDtos(documents: ProjectDocument[]): Promise<ProjectDocumentDto[]> {
    const counts = await this.acceptedBlockCounts(documents.map((d) => d.id));

    return documents.map((document) =>
      Object.assign(new ProjectDocumentDto(), {
        id: document.id,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        title: document.title,
        originalName: document.file?.originalName ?? document.title,
        mimeType: document.file?.mimeType ?? '',
        sizeBytes: document.file?.sizeBytes ?? 0,
        fileId: document.fileId,
        status: document.status,
        error: document.error,
        blockCount: counts.get(document.id) ?? 0,
      }),
    );
  }

  private async acceptedBlockCounts(documentIds: string[]): Promise<Map<string, number>> {
    if (documentIds.length === 0) return new Map();

    const rows = await this.blocks
      .createQueryBuilder('block')
      .select('block.source_document_id', 'documentId')
      .addSelect('COUNT(*)', 'count')
      .where('block.source_document_id IN (:...documentIds)', { documentIds })
      .andWhere('block.state = :state', { state: 'accepted' })
      .groupBy('block.source_document_id')
      .getRawMany<{ documentId: string; count: string }>();

    return new Map(rows.map((row) => [row.documentId, Number(row.count)]));
  }
}
