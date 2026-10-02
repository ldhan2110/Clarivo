import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  lastQuery: '' as string,
  response: {} as unknown,
}));

vi.mock('@langchain/tavily', () => ({
  TavilySearch: class {
    constructor(_opts: unknown) {}
    async invoke(input: { query: string }) {
      h.lastQuery = input.query;
      return h.response;
    }
  },
}));

import { WebResearch } from './web-research';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config = { get: () => 'tvly-key' } as any;

describe('WebResearch.search', () => {
  beforeEach(() => {
    h.lastQuery = '';
    h.response = {
      results: [
        { title: 'About Sambu Vina', url: 'https://sambuvina.com/about', raw_content: 'Automotive seat parts in Binh Duong.' },
        { title: 'Profile', url: 'https://vietnamcredit.com.vn/sambu-vina', content: '800 staff, two plants.' },
      ],
    };
  });

  it('builds a query from the company name and what they are building', async () => {
    const r = new WebResearch(config);
    await r.search({ companyName: 'SAMBU VINA', building: 'dispatch system' });
    expect(h.lastQuery).toContain('SAMBU VINA');
    expect(h.lastQuery).toContain('dispatch system');
  });

  it('maps hits to pages with extract and a findings digest', async () => {
    const r = new WebResearch(config);
    const out = await r.search({ companyName: 'SAMBU VINA' });
    expect(out.pages).toHaveLength(2);
    expect(out.pages[0]).toMatchObject({ url: 'https://sambuvina.com/about' });
    expect(out.pages[0].extract).toContain('Automotive seat parts');
    expect(out.findings_md).toContain('About Sambu Vina');
  });

  it('returns empty (not an error) when there are no results', async () => {
    h.response = { results: [] };
    const r = new WebResearch(config);
    const out = await r.search({ companyName: 'Nobody Inc' });
    expect(out).toEqual({ findings_md: '', pages: [] });
  });

  it('uses the url as the query when no name is given', async () => {
    const r = new WebResearch(config);
    await r.search({ url: 'https://sambuvina.com' });
    expect(h.lastQuery).toBe('https://sambuvina.com');
  });
});
