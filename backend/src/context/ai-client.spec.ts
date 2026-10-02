import { beforeEach, describe, expect, it, vi } from 'vitest';

// Record which model each invoke ran against, and let the reduce output be
// steerable per test (to prove a malformed mermaid block is passed through).
const h = vi.hoisted(() => ({
  calls: [] as string[],
  reduceOutput: 'ok',
}));

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class {
    model: string;
    constructor(opts: { model: string }) {
      this.model = opts.model;
    }
    pipe() {
      const model = this.model;
      return {
        invoke: async () => {
          h.calls.push(model);
          return model.includes('strong') ? h.reduceOutput : `facts[${model}]`;
        },
      };
    }
  },
}));

import { AiClient } from './ai-client';

const config = {
  get: (k: string) =>
    (
      ({
        AI_BASE_URL: 'http://ai.test/v1',
        AI_API_KEY: 'k',
        AI_MODEL_FAST: 'model-fast',
        AI_MODEL_STRONG: 'model-strong',
      }) as Record<string, string>
    )[k],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('AiClient.summarise', () => {
  beforeEach(() => {
    h.calls = [];
    h.reduceOutput = '## Overview\nText.\nSources: a.md';
  });

  it('reduces with the STRONG model and skips the map for a short source', async () => {
    const client = new AiClient(config);
    const out = await client.summarise({
      domain: 'logistics',
      objective: null,
      customerBu: 'CLT',
      sources: [{ title: 'a.md', text: 'short text', kind: 'doc' }],
    });
    expect(h.calls).toEqual(['model-strong']); // no map call for a single short segment
    expect(out).toContain('## Overview');
  });

  it('maps a large source with the FAST model before the STRONG reduce', async () => {
    const client = new AiClient(config);
    await client.summarise({
      domain: 'logistics',
      objective: 'x',
      customerBu: 'CLT',
      sources: [{ title: 'big.pdf', text: 'x'.repeat(20000), kind: 'doc' }],
    });
    expect(h.calls.filter((m) => m === 'model-fast').length).toBeGreaterThan(0);
    expect(h.calls.at(-1)).toBe('model-strong'); // reduce runs last
  });

  it('passes a malformed mermaid block through unchanged (never fatal)', async () => {
    h.reduceOutput = '## Process\n```mermaid\ngraph TD; A--oops\n```\nSources: p.pdf';
    const client = new AiClient(config);
    const out = await client.summarise({
      domain: 'd',
      objective: null,
      customerBu: 'c',
      sources: [{ title: 'p.pdf', text: 'short', kind: 'doc' }],
    });
    expect(out).toContain('A--oops');
  });
});
