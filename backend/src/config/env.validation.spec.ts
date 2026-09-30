import { describe, expect, it } from 'vitest';
import { corsOrigins, validate } from './env.validation';

const base = {
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5433',
  DATABASE_USER: 'u',
  DATABASE_PASSWORD: 'p',
  DATABASE_NAME: 'db',
  JWT_SECRET: 's',
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
});

describe('corsOrigins', () => {
  it('keeps the wildcard as a wildcard', () => {
    expect(corsOrigins('*')).toBe('*');
  });

  it('splits and trims an origin list', () => {
    expect(corsOrigins('http://a.com, http://b.com ,')).toEqual(['http://a.com', 'http://b.com']);
  });
});
