import { describe, expect, it } from 'vitest';

/**
 * Task 0 spike — prove the LangChain packages resolve and instantiate under this
 * repo's CommonJS (`"type":"commonjs"`) + `module:nodenext` build. The packages
 * are dual-published (`exports["."].require` → `.cjs`); this exercises that path
 * on our actual tsconfig before anything depends on them. If a sub-dep were
 * ESM-only, the import below would throw at load time.
 */
describe('LangChain loads under CommonJS', () => {
  it('imports and instantiates ChatOpenAI', async () => {
    const { ChatOpenAI } = await import('@langchain/openai');
    const model = new ChatOpenAI({
      apiKey: 'test-key',
      model: 'gpt-test',
      configuration: { baseURL: 'http://localhost:0/v1' },
    });
    expect(model).toBeDefined();
  });

  it('imports and instantiates TavilySearch', async () => {
    const { TavilySearch } = await import('@langchain/tavily');
    const tool = new TavilySearch({ tavilyApiKey: 'test-key', maxResults: 3 });
    expect(tool).toBeDefined();
  });

  it('imports a text splitter from @langchain/textsplitters', async () => {
    const { RecursiveCharacterTextSplitter } = await import(
      '@langchain/textsplitters'
    );
    expect(RecursiveCharacterTextSplitter).toBeDefined();
  });
});
