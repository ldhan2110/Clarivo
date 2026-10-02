import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectDocument } from './project-document.entity';
import { ProjectKnowledge } from './project-knowledge.entity';
import { DocumentParser } from './document-parser';
import { AiClient, KNOWLEDGE_SECTIONS, type SummarySource } from './ai-client';
import { WebResearch, type ResearchPage, type ResearchResult } from './web-research';
import { ContextErrors } from './context.errors';
import { FilesService } from '../files/files.service';
import { ProjectsService } from '../projects/projects.service';
import type { UploadedFile } from '../files/files.service';
import type { FileEntity } from '../files/file.entity';
import { Project } from '../projects/project.entity';

export interface SourceView {
  id: string;
  sourceType: 'doc' | 'web';
  title: string;
  url: string | null;
  status: string;
  failureReason: string | null;
  processedAt: Date | null;
}

export interface ContextView {
  summaryMd: string;
  edited: boolean;
  generatedAt: Date | null;
  processing: boolean;
  coverage: { covered: number; total: number };
  sources: SourceView[];
}

@Injectable()
export class ContextService implements OnModuleInit {
  private readonly logger = new Logger(ContextService.name);

  constructor(
    @InjectRepository(ProjectDocument)
    private readonly documents: Repository<ProjectDocument>,
    @InjectRepository(ProjectKnowledge)
    private readonly knowledge: Repository<ProjectKnowledge>,
    @InjectRepository(Project)
    private readonly projectRows: Repository<Project>,
    private readonly files: FilesService,
    private readonly parser: DocumentParser,
    private readonly ai: AiClient,
    private readonly web: WebResearch,
    private readonly projects: ProjectsService,
  ) {}

  /**
   * Crash recovery: a row left `processing` means a previous run died mid-flight.
   * Flip it to `failed` so it is visible and re-processable, never stuck.
   * ponytail: a boot sweep, not a job queue — fine for one in-process instance.
   */
  async onModuleInit(): Promise<void> {
    const { affected } = await this.documents.update(
      { status: 'processing' },
      { status: 'failed', failureReason: 'Interrupted by a restart; re-process it.' },
    );
    if (affected) this.logger.warn(`Swept ${affected} stuck document(s) to failed`);
  }

  async addDocument(
    projectId: string,
    viewerId: string,
    file: UploadedFile,
  ): Promise<SourceView> {
    await this.projects.requireProject(projectId, viewerId);
    const stored = await this.files.store(file, viewerId);
    const doc = await this.documents.save(
      this.documents.create({
        projectId,
        sourceType: 'doc',
        fileId: stored.id,
        url: null,
        title: stored.originalName,
        status: 'new',
        uploadedBy: viewerId,
      }),
    );
    return this.toSourceView(doc);
  }

  /** Search only — persists nothing. */
  async research(
    projectId: string,
    viewerId: string,
    opts: { companyName?: string; url?: string; building?: string },
  ): Promise<ResearchResult> {
    await this.projects.requireProject(projectId, viewerId);
    if (!opts.companyName && !opts.url) throw ContextErrors.RESEARCH_QUERY_REQUIRED();
    return this.web.search(opts);
  }

  /** Persist confirmed research pages as web sources, text already fetched. */
  async acceptResearch(
    projectId: string,
    viewerId: string,
    pages: ResearchPage[],
  ): Promise<SourceView[]> {
    await this.projects.requireProject(projectId, viewerId);
    const rows = pages.map((p) =>
      this.documents.create({
        projectId,
        sourceType: 'web' as const,
        fileId: null,
        url: p.url,
        title: p.title,
        extractedText: p.extract,
        status: 'new' as const,
        uploadedBy: viewerId,
      }),
    );
    const saved = await this.documents.save(rows);
    return saved.map((d) => this.toSourceView(d));
  }

  /**
   * Kick the background run if anything is unprocessed. Returns whether a run
   * started so the controller can answer 202 vs 200.
   */
  async processAll(projectId: string, viewerId: string): Promise<{ started: boolean }> {
    await this.projects.requireProject(projectId, viewerId);
    const pending = await this.documents.count({
      where: { projectId, status: 'new' },
    });
    if (pending === 0) return { started: false };
    void this.runPipeline(projectId).catch((e) =>
      this.logger.error(`Pipeline failed for ${projectId}: ${String(e)}`),
    );
    return { started: true };
  }

  /** The actual processing + summary. Awaitable so tests drive it directly. */
  async runPipeline(projectId: string): Promise<void> {
    const sources = await this.documents.find({ where: { projectId, status: 'new' } });
    for (const source of sources) {
      await this.processSource(source);
    }
    // Generate unless a human owns the page — their edits are never clobbered.
    const page = await this.knowledge.findOne({ where: { projectId } });
    if (!page?.edited) await this.generateSummary(projectId);
  }

  private async processSource(source: ProjectDocument): Promise<void> {
    await this.documents.update(source.id, { status: 'processing' });
    try {
      if (source.sourceType === 'doc') {
        const file = await this.files.findById(source.fileId as string);
        const buffer = await this.readBytes(file);
        const { text } = await this.parser.parse(buffer, file.mimeType);
        source.extractedText = text;
      }
      // web sources already carry their extract from acceptResearch.
      if (!source.extractedText?.trim()) {
        throw ContextErrors.UNREADABLE_SOURCE({ id: source.id });
      }
      await this.documents.update(source.id, {
        status: 'processed',
        extractedText: source.extractedText,
        processedAt: new Date(),
        failureReason: null,
      });
    } catch (e) {
      await this.documents.update(source.id, {
        status: 'failed',
        failureReason: e instanceof Error ? e.message : 'Could not process this source',
      });
    }
  }

  private async generateSummary(projectId: string): Promise<void> {
    const project = await this.projectRows.findOne({ where: { id: projectId } });
    if (!project) throw ContextErrors.NOT_FOUND({ projectId });
    const processed = await this.documents.find({
      where: { projectId, status: 'processed' },
    });
    const sources: SummarySource[] = processed.map((d) => ({
      title: d.title,
      text: d.extractedText ?? '',
      kind: d.sourceType,
    }));
    const summaryMd = await this.ai.summarise({
      domain: project.domain,
      objective: project.objective,
      customerBu: project.customerBu,
      sources,
    });
    await this.upsertKnowledge(projectId, { summaryMd, edited: false, generatedAt: new Date() });
  }

  async getContext(projectId: string, viewerId: string): Promise<ContextView> {
    await this.projects.requireProject(projectId, viewerId);
    const [page, sources] = await Promise.all([
      this.knowledge.findOne({ where: { projectId } }),
      this.documents.find({ where: { projectId }, order: { createdAt: 'ASC' } }),
    ]);
    return {
      summaryMd: page?.summaryMd ?? '',
      edited: page?.edited ?? false,
      generatedAt: page?.generatedAt ?? null,
      processing: sources.some((s) => s.status === 'processing' || s.status === 'new'),
      coverage: this.coverage(page?.summaryMd ?? ''),
      sources: sources.map((s) => this.toSourceView(s)),
    };
  }

  async listSources(projectId: string, viewerId: string): Promise<SourceView[]> {
    await this.projects.requireProject(projectId, viewerId);
    const rows = await this.documents.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => this.toSourceView(r));
  }

  async editSummary(projectId: string, viewerId: string, summaryMd: string): Promise<ContextView> {
    await this.projects.requireProject(projectId, viewerId);
    await this.upsertKnowledge(projectId, { summaryMd, edited: true });
    return this.getContext(projectId, viewerId);
  }

  async regenerate(
    projectId: string,
    viewerId: string,
    force: boolean,
  ): Promise<ContextView> {
    await this.projects.requireProject(projectId, viewerId);
    const page = await this.knowledge.findOne({ where: { projectId } });
    if (page?.edited && !force) throw ContextErrors.SUMMARY_EDITED({ projectId });
    await this.generateSummary(projectId);
    return this.getContext(projectId, viewerId);
  }

  // --- helpers ---

  private async upsertKnowledge(
    projectId: string,
    patch: Partial<Pick<ProjectKnowledge, 'summaryMd' | 'edited' | 'generatedAt'>>,
  ): Promise<void> {
    const existing = await this.knowledge.findOne({ where: { projectId } });
    if (existing) {
      await this.knowledge.update(existing.id, patch);
    } else {
      await this.knowledge.save(this.knowledge.create({ projectId, ...patch }));
    }
  }

  private coverage(summaryMd: string): { covered: number; total: number } {
    const total = KNOWLEDGE_SECTIONS.length;
    if (!summaryMd.trim()) return { covered: 0, total };
    let covered = 0;
    for (const section of KNOWLEDGE_SECTIONS) {
      const re = new RegExp(`^##\\s+${section}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, 'im');
      const body = summaryMd.match(re)?.[1]?.trim() ?? '';
      if (body && !/_thin/i.test(body)) covered += 1;
    }
    return { covered, total };
  }

  private async readBytes(file: FileEntity): Promise<Buffer> {
    const stream = this.files.createStream(file);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  private toSourceView(d: ProjectDocument): SourceView {
    return {
      id: d.id,
      sourceType: d.sourceType,
      title: d.title,
      url: d.url,
      status: d.status,
      failureReason: d.failureReason,
      processedAt: d.processedAt,
    };
  }
}
