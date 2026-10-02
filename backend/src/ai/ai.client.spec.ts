import { IsInt, IsString } from 'class-validator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiClient } from './ai.client';

class AnswerDto {
  @IsString()
  summary: string;

  @IsInt()
  pages: number;
}

/** The env the client reads, with no ConfigService around it. */
const config = {
  get: (key: string) => (key === 'AI_BASE_URL' ? 'https://ai.test/v1/' : 'test-key'),
} as any;

function completion(content: string, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

let client: AiClient;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  client = new AiClient(config);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const request = {
  model: 'model-x',
  system: 'be terse',
  user: 'summarise',
  schema: AnswerDto,
};

describe('AiClient.complete', () => {
  it('resolves a valid JSON response into the schema instance', async () => {
    fetchMock.mockResolvedValue(completion('{"summary":"ok","pages":3}'));

    const result = await client.complete(request);

    expect(result).toBeInstanceOf(AnswerDto);
    expect(result.summary).toBe('ok');
    expect(result.pages).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('calls <base>/chat/completions with the model and both messages', async () => {
    fetchMock.mockResolvedValue(completion('{"summary":"ok","pages":1}'));

    await client.complete(request);

    const [url, init] = fetchMock.mock.calls[0];
    // The trailing slash on AI_BASE_URL must not produce a doubled one.
    expect(url).toBe('https://ai.test/v1/chat/completions');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('model-x');
    expect(body.messages).toEqual([
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'summarise' },
    ]);
    expect(init.headers.authorization).toBe('Bearer test-key');
  });

  it('unwraps a ```json fence rather than spending a retry on it', async () => {
    fetchMock.mockResolvedValue(completion('```json\n{"summary":"fenced","pages":2}\n```'));

    const result = await client.complete(request);

    expect(result.summary).toBe('fenced');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once on unparseable JSON, then throws AI_UNAVAILABLE', async () => {
    fetchMock.mockResolvedValue(completion('I am afraid I cannot do that'));

    await expect(client.complete(request)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries once when the JSON parses but fails validation', async () => {
    fetchMock.mockResolvedValue(completion('{"summary":"ok","pages":"three"}'));

    await expect(client.complete(request)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('accepts a retry that succeeds after a malformed first answer', async () => {
    fetchMock
      .mockResolvedValueOnce(completion('not json'))
      .mockResolvedValueOnce(completion('{"summary":"second","pages":9}'));

    const result = await client.complete(request);

    expect(result.summary).toBe('second');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws AI_UNAVAILABLE on a non-200 without retrying', async () => {
    fetchMock.mockResolvedValue(completion('', false, 429));

    await expect(client.complete(request)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      status: 502,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws AI_UNAVAILABLE when the transport fails', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(client.complete(request)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('throws AI_UNAVAILABLE on an empty completion', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [] }) });

    await expect(client.complete(request)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });
});
