import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import type { EnvironmentVariables } from '../config/env.validation';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

/** One source the summary is built from. */
export interface SummarySource {
  title: string;
  text: string;
  kind: 'doc' | 'web';
}

export interface SummaryInput {
  domain: string;
  objective: string | null;
  customerBu: string;
  sources: SummarySource[];
}

/** The nine fixed knowledge sections, in order. */
export const KNOWLEDGE_SECTIONS = [
  'Overview',
  'Scope',
  'Stakeholders',
  'Process',
  'Data model',
  'Constraints',
  'Integrations',
  'Glossary',
  'Open questions',
] as const;

// Char budget per map segment. A source under this skips the map and is reduced
// directly. ponytail: a fixed budget, not a token count — good enough until a
// model's context window actually bites, then swap in a tokeniser.
const SEGMENT_CHARS = 8000;

/**
 * Wraps LangChain `ChatOpenAI` for the context summariser. One OpenAI-compatible
 * endpoint (`AI_BASE_URL`), two models: FAST for the per-segment map (the bulk of
 * the tokens), STRONG for the single reduce that writes the final markdown. The
 * same `ChatOpenAI` wrapper is what the later discovery agent reuses.
 */
@Injectable()
export class AiClient {
  private readonly fast: ChatOpenAI;
  private readonly strong: ChatOpenAI;
  private readonly parser = new StringOutputParser();

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const baseURL = config.get('AI_BASE_URL', { infer: true });
    const apiKey = config.get('AI_API_KEY', { infer: true });
    const mk = (model: string) =>
      new ChatOpenAI({ apiKey, model, temperature: 0.2, configuration: { baseURL } });
    this.fast = mk(config.get('AI_MODEL_FAST', { infer: true }));
    this.strong = mk(config.get('AI_MODEL_STRONG', { infer: true }));
  }

  /**
   * Map-reduce the sources into one markdown summary. Each source is split and
   * map-summarised with the FAST model; the digests are then reduced by the
   * STRONG model into the nine fixed sections, with a `Sources:` line per
   * section, inline `⚠ Sources differ` notes on contradiction, and ```mermaid
   * blocks where the content supports a diagram.
   */
  async summarise(input: SummaryInput): Promise<string> {
    // ponytail: driven by ContextService's in-process background run (one summary
    // at a time, no queue). If concurrent projects or retries matter, move the
    // Process-all run onto a job queue (BullMQ/pg-boss) — not before.
    const digests: string[] = [];
    for (const source of input.sources) {
      digests.push(await this.mapSource(source));
    }
    return this.reduce(input, digests);
  }

  private async mapSource(source: SummarySource): Promise<string> {
    const segments = await this.split(source.text);
    // Single segment: skip the map, hand the text straight to reduce.
    if (segments.length <= 1) {
      return `### ${source.title} (${source.kind})\n${source.text}`;
    }
    const partials: string[] = [];
    for (const [i, seg] of segments.entries()) {
      const out = await this.fast.pipe(this.parser).invoke([
        {
          role: 'system',
          content:
            'Extract the concrete facts from this document segment as terse bullet points. ' +
            'Keep names, numbers, thresholds and rules verbatim. No preamble.',
        },
        { role: 'user', content: `Document: ${source.title}\nSegment ${i + 1}:\n${seg}` },
      ]);
      partials.push(out);
    }
    return `### ${source.title} (${source.kind})\n${partials.join('\n')}`;
  }

  private async reduce(input: SummaryInput, digests: string[]): Promise<string> {
    const sections = KNOWLEDGE_SECTIONS.map((s) => `## ${s}`).join('\n');
    return this.strong.pipe(this.parser).invoke([
      {
        role: 'system',
        content: [
          'You write a single markdown knowledge summary for a business analyst.',
          'Use EXACTLY these level-2 sections, in this order:',
          sections,
          'Rules:',
          '- Under each section, write prose or bullets grounded ONLY in the provided sources and project facts.',
          '- End each non-empty section with a line `Sources: <source titles or URLs>`.',
          '- If two sources contradict, keep both and add a line `⚠ Sources differ: <what differs>`.',
          '- Where a process or system context is described, include a ```mermaid diagram.',
          '- If a section has nothing, write `_Thin — likely a discovery question._` and no Sources line.',
          '- Do not invent facts. Do not add sections beyond the nine.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Project domain: ${input.domain}`,
          `Customer/BU: ${input.customerBu}`,
          `Objective: ${input.objective ?? '(none stated)'}`,
          '',
          'Source digests:',
          ...digests,
        ].join('\n'),
      },
    ]);
  }

  private split(text: string): Promise<string[]> {
    if (text.length <= SEGMENT_CHARS) return Promise.resolve([text]);
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: SEGMENT_CHARS,
      chunkOverlap: 200,
    });
    return splitter.splitText(text);
  }
}
