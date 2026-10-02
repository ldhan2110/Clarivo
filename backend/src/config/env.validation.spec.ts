import { describe, expect, it } from 'vitest';
import { corsOrigins, validate } from './env.validation';

const base = {
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5433',
  DATABASE_USER: 'u',
  DATABASE_PASSWORD: 'p',
  DATABASE_NAME: 'db',
  JWT_SECRET: 's',
  FILE_STORAGE_PATH: '/tmp/clarivo-files',
  AI_BASE_URL: 'https://ai.test/v1',
  AI_API_KEY: 'k',
  AI_MODEL_FAST: 'fast',
  AI_MODEL_STRONG: 'strong',
  TAVILY_API_KEY: 'tvly-k',
  SEED_ADMIN_EMAIL: 'a@b.c',
  SEED_ADMIN_PASSWORD: 'p',
  SEED_ADMIN_NAME: 'N',
};

describe('validate', () => {
  it('defaults CORS_ORIGINS and SWAGGER_ENABLED', () => {
    const env = validate(base);
    expect(env.CORS_ORIGINS).toBe('*');
    expect(env.SWAGGER_ENABLED).toBe(true);
  });

  it('reads SWAGGER_ENABLED=false as a boolean false', () => {
    expect(validate({ ...base, SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED).toBe(false);
    expect(validate({ ...base, SWAGGER_ENABLED: 'true' }).SWAGGER_ENABLED).toBe(true);
  });

  it('defaults JWT_EXPIRES_IN', () => {
    expect(validate(base).JWT_EXPIRES_IN).toBe('30d');
  });

  it('refuses to boot without JWT_SECRET', () => {
    const { JWT_SECRET: _omitted, ...withoutSecret } = base;
    expect(() => validate(withoutSecret)).toThrow(/JWT_SECRET/);
  });

  it('refuses to boot without FILE_STORAGE_PATH', () => {
    const { FILE_STORAGE_PATH: _omitted, ...withoutPath } = base;
    expect(() => validate(withoutPath)).toThrow(/FILE_STORAGE_PATH/);
  });

  it('has no default for FILE_STORAGE_PATH', () => {
    expect(validate(base).FILE_STORAGE_PATH).toBe('/tmp/clarivo-files');
    expect(() => validate({ ...base, FILE_STORAGE_PATH: '' })).toThrow(/FILE_STORAGE_PATH/);
  });

  it('refuses to boot without the AI provider contract', () => {
    const keys = ['AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL_FAST', 'AI_MODEL_STRONG'] as const;
    for (const key of keys) {
      const { [key]: _omitted, ...without } = base;
      expect(() => validate(without)).toThrow(new RegExp(key));
    }
  });

  it('refuses to boot without TAVILY_API_KEY', () => {
    const { TAVILY_API_KEY: _omitted, ...without } = base;
    expect(() => validate(without)).toThrow(/TAVILY_API_KEY/);
  });
});

describe('corsOrigins', () => {
  it('keeps the wildcard as a wildcard', () => {
    expect(corsOrigins('*')).toBe('*');
  });

  it('splits and trims an origin list', () => {
    expect(corsOrigins('http://a.com, http://b.com ,')).toEqual(['http://a.com', 'http://b.com']);
  });
});
