import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiClient } from '../ai/ai.client';
import type { EnvironmentVariables } from '../config/env.validation';
import { FilesService } from '../files/files.service';
import { SummaryDto } from './ai-schemas';
import { extract, type Segment } from './parser/document-parser';
import { ProjectDocument } from './project-document.entity';
import { ProposalGenerator } from './proposal-generator';

/** Characters per map group. A character budget needs no tokenizer dependency. */
export const GROUP_CHARS = 6000;

const MAP_SYSTEM =
  'You summarise one part of a business document for a business analyst. ' +
  'Keep every concrete fact: names, numbers, dates, systems, rules and open questions. ' +
  'Drop nothing that a requirement could later depend on. ' +
  'Reply as JSON: {"summary": "..."}.';

const REDUCE_SYSTEM =
  'You merge partial summaries of one business document into a single digest for a ' +
  'business analyst. Preserve every concrete fact, resolve repetition, and keep the ' +
  "document's own terminology. Reply as JSON: {\"summary\": \"...\"}.";

/**
 * Drives one document from pending to ready or failed, in-process.
 *
 * ponytail: in-process, single instance. pg-boss when a second instance exists.
 */
@Injectable()
export class ContextPipeline {
  private readonly logger = new Logger(ContextPipeline.name);
  private readonly fastModel: string;
  private readonly strongModel: string;

  /** Ten uploads must not open ten simultaneous model calls. */
  private running = 0;
  private readonly queue: (() => void)[] = [];
  private static readonly MAX_IN_FLIGHT = 2;

  constructor(
    @InjectRepository(ProjectDocument)
    private readonly documents: Repository<ProjectDocument>,
    private readonly files: FilesService,
    private readonly ai: AiClient,
    private readonly proposals: ProposalGenerator,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.fastModel = config.get('AI_MODEL_FAST', { infer: true });
    this.strongModel = config.get('AI_MODEL_STRONG', { infer: true });
  }

  /**
   * Never throws: the caller is a fire-and-forget `void` after the 201, so a
   * rejection here would be an unhandled promise. Failure is a row state.
   */
  async run(documentId: string): Promise<void> {
    await this.acquire();
    try {
      await this.process(documentId);
    } catch (error) {
      await this.fail(documentId, error);
    } finally {
      this.release();
    }
  }

  /** Re-propose from the stored digest — no re-parse, no map cost. */
  async repropose(documentId: string): Promise<void> {
    await this.acquire();
    try {
      const document = await this.load(documentId);
      if (!document.digest) throw new Error('This document has no digest to re-read');

      await this.setStatus(document, 'proposing');
      const segments = await this.extractSegments(document);
      await this.proposals.generate(document, document.digest, joinText(segments));
      await this.setStatus(document, 'ready');
    } catch (error) {
      await this.fail(documentId, error);
    } finally {
      this.release();
    }
  }

  private async process(documentId: string): Promise<void> {
    const document = await this.load(documentId);

    await this.setStatus(document, 'parsing');
    const segments = await this.extractSegments(document);
    const text = joinText(segments);
    document.charCount = text.length;

    await this.setStatus(document, 'summarizing');
    document.digest = await this.summarise(segments);
    await this.documents.save(document);

    await this.setStatus(document, 'proposing');
    await this.proposals.generate(document, document.digest, text);

    await this.setStatus(document, 'ready');
  }

  private async extractSegments(document: ProjectDocument): Promise<Segment[]> {
    const file = document.file ?? (await this.loadWithFile(document.id)).file;
    return extract(this.files.absolute(file.storageKey), file.mimeType);
  }

  /**
   * Map with the cheap model, reduce with the strong one. A document that fits
   * in one group skips the map pass entirely — the reduce prompt reads the
   * text directly, so the fast model is never called for it.
   */
  private async summarise(segments: Segment[]): Promise<string> {
    const groups = groupSegments(segments, GROUP_CHARS);

    const parts =
      groups.length === 1
        ? groups
        : await Promise.all(
            groups.map(async (group, index) => {
              const { summary } = await this.ai.complete({
                model: this.fastModel,
                system: MAP_SYSTEM,
                user: `Part ${index + 1} of ${groups.length}:\n\n${group}`,
                schema: SummaryDto,
              });
              return summary;
            }),
          );

    const { summary } = await this.ai.complete({
      model: this.strongModel,
      system: REDUCE_SYSTEM,
      user: parts.join('\n\n---\n\n'),
      schema: SummaryDto,
    });
    return summary;
  }

  private async load(documentId: string): Promise<ProjectDocument> {
    return this.loadWithFile(documentId);
  }

  private async loadWithFile(documentId: string): Promise<ProjectDocument> {
    const document = await this.documents.findOne({
      where: { id: documentId },
      relations: { file: true },
    });
    if (!document) throw new Error(`Document ${documentId} no longer exists`);
    return document;
  }

  private async setStatus(
    document: ProjectDocument,
    status: ProjectDocument['status'],
  ): Promise<void> {
    document.status = status;
    document.error = null;
    await this.documents.save(document);
  }

  /**
   * One document failing must leave every other document and every existing
   * block untouched, so this only ever writes this row.
   */
  private async fail(documentId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Document ${documentId} failed: ${message}`);
    try {
      await this.documents.update(documentId, { status: 'failed', error: message });
    } catch (writeError) {
      this.logger.error(
        `Could not record the failure of ${documentId}: ${(writeError as Error).message}`,
      );
    }
  }

  private async acquire(): Promise<void> {
    if (this.running < ContextPipeline.MAX_IN_FLIGHT) {
      this.running += 1;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.running += 1;
  }

  private release(): void {
    this.running -= 1;
    this.queue.shift()?.();
  }
}

/** Merges whole segments up to the budget so a locator is never split. */
export function groupSegments(segments: Segment[], budget: number): string[] {
  const groups: string[] = [];
  let current = '';

  for (const segment of segments) {
    const piece = segment.locator ? `[${segment.locator}] ${segment.text}` : segment.text;
    if (current && current.length + piece.length > budget) {
      groups.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${piece}` : piece;
  }
  if (current) groups.push(current);

  return groups.length > 0 ? groups : [''];
}

function joinText(segments: Segment[]): string {
  return segments.map((segment) => segment.text).join('\n\n');
}
