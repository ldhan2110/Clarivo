import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { EnvironmentVariables } from '../config/env.validation';
import { AiErrors } from './ai.errors';

/** Any class-validator-decorated class the caller wants the response shaped as. */
export type ResponseSchema<T> = new () => T;

export interface CompletionRequest<T extends object> {
  /** AI_MODEL_FAST or AI_MODEL_STRONG — the caller picks by cost. */
  model: string;
  system: string;
  user: string;
  /**
   * The response is always a JSON *object* validated against this class.
   * A list is carried as a property on it, never as a bare array root: most
   * providers' JSON mode requires an object root.
   */
  schema: ResponseSchema<T>;
}

/**
 * One OpenAI-compatible client over native fetch — OpenRouter, Omniroute and
 * direct providers all speak this shape. No vendor SDK and no provider
 * registry: there is exactly one implementation and nothing to choose between.
 *
 * Every response is validated with class-validator the same way a request body
 * is. A malformed one is retried once and then throws, so a caller never has to
 * decide whether half an answer is usable.
 */
@Injectable()
export class AiClient {
  private readonly logger = new Logger(AiClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.baseUrl = config.get('AI_BASE_URL', { infer: true }).replace(/\/+$/, '');
    this.apiKey = config.get('AI_API_KEY', { infer: true });
  }

  async complete<T extends object>(request: CompletionRequest<T>): Promise<T> {
    // Two attempts, not a loop with a backoff: a model that answered with
    // prose twice will answer with prose a third time.
    for (let attempt = 1; attempt <= 2; attempt++) {
      const content = await this.post(request);
      const parsed = this.validate(content, request.schema);
      if (parsed) return parsed;
      this.logger.warn(`Malformed AI response from ${request.model} (attempt ${attempt}/2)`);
    }
    throw AiErrors.UNAVAILABLE({ model: request.model, reason: 'malformed response' });
  }

  /** A non-200, a transport failure or a bodyless choice is terminal — no retry. */
  private async post<T extends object>(request: CompletionRequest<T>): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          response_format: { type: 'json_object' },
        }),
      });
    } catch (error) {
      throw AiErrors.UNAVAILABLE({ model: request.model, reason: (error as Error).message });
    }

    if (!response.ok) {
      throw AiErrors.UNAVAILABLE({ model: request.model, status: response.status });
    }

    const body = (await response.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
    } | null;
    const content = body?.choices?.[0]?.message?.content;
    if (!content) {
      throw AiErrors.UNAVAILABLE({ model: request.model, reason: 'empty completion' });
    }
    return content;
  }

  /** null means "retry this" — any failure to become a valid instance. */
  private validate<T extends object>(content: string, schema: ResponseSchema<T>): T | null {
    let raw: unknown;
    try {
      raw = JSON.parse(stripFence(content));
    } catch {
      return null;
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

    const instance = plainToInstance(schema, raw, { enableImplicitConversion: false });
    const errors = validateSync(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: false,
      skipMissingProperties: false,
    });
    return errors.length === 0 ? instance : null;
  }
}

/** Models wrap JSON in ```json fences often enough that unwrapping beats a retry. */
function stripFence(content: string): string {
  const fenced = /^\s*```(?:json)?\s*\n([\s\S]*?)\n?\s*```\s*$/.exec(content);
  return fenced ? fenced[1] : content;
}
