import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TavilySearch } from '@langchain/tavily';

export interface ResearchPage {
  title: string;
  url: string;
  /** The fetched extract — stored as a web source's extracted_text. */
  extract: string;
}

export interface ResearchResult {
  findings_md: string;
  pages: ResearchPage[];
}

interface TavilyHit {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string;
}

/**
 * Wraps LangChain `TavilySearch` for customer research. Given a company name (and
 * optionally what they are building) or a URL, it searches the web and returns
 * draft findings plus the pages it read. This is the same tool the later
 * discovery agent reuses. Zero results is not an error — it returns empty.
 */
@Injectable()
export class WebResearch {
  private readonly tool: TavilySearch;

  constructor(config: ConfigService) {
    this.tool = new TavilySearch({
      tavilyApiKey: config.get('TAVILY_API_KEY', { infer: true }) as string,
      maxResults: 5,
      includeRawContent: true,
    });
  }

  async search(opts: {
    companyName?: string;
    url?: string;
    building?: string;
  }): Promise<ResearchResult> {
    const query = opts.companyName
      ? [opts.companyName, opts.building, 'company overview industry domain']
          .filter(Boolean)
          .join(' ')
      : (opts.url as string);

    const raw = await this.tool.invoke({ query });
    const parsed = typeof raw === 'string' ? safeParse(raw) : raw;
    const hits: TavilyHit[] = parsed?.results ?? [];

    const pages: ResearchPage[] = hits
      .filter((h) => h.url)
      .map((h) => ({
        title: h.title?.trim() || (h.url as string),
        url: h.url as string,
        extract: (h.raw_content || h.content || '').trim(),
      }))
      .filter((p) => p.extract);

    if (pages.length === 0) return { findings_md: '', pages: [] };

    const findings_md = pages
      .map((p) => `### ${p.title}\n${truncate(p.extract, 600)}\n\nSource: ${p.url}`)
      .join('\n\n');

    return { findings_md, pages };
  }
}

function safeParse(s: string): { results?: TavilyHit[] } {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
