import { Transform, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DATABASE_PORT: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_USER: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_SCHEMA: string = 'public';

  /** Comma-separated allowed origins, or '*' for any. */
  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS: string = '*';

  /** Swagger UI is served at /docs unless this is false. */
  // Reads the raw string off `obj`: enableImplicitConversion already coerced
  // `value`, and Boolean('false') is true.
  @IsBoolean()
  @Transform(({ obj }) => obj.SWAGGER_ENABLED !== 'false' && obj.SWAGGER_ENABLED !== false)
  SWAGGER_ENABLED: boolean = true;

  /** Signing key for session JWTs. No default — an unset secret must kill the boot. */
  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  /** Lifetime of a session token, in the `ms` notation jsonwebtoken accepts. */
  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string = '30d';

  /**
   * Absolute root directory for stored files. No default: an unset value must
   * kill the boot rather than silently scattering uploads somewhere unexpected.
   * The database stores only keys relative to this, so the directory can move
   * between environments without a data migration.
   */
  @IsString()
  @IsNotEmpty()
  FILE_STORAGE_PATH: string;

  /**
   * OpenAI-compatible AI provider. Required with no code default: a missing
   * key must kill the boot rather than surface as a 502 on the first upload.
   * AI_BASE_URL is the API root without a trailing slash — the client appends
   * `/chat/completions`.
   */
  @IsString()
  @IsNotEmpty()
  AI_BASE_URL: string;

  @IsString()
  @IsNotEmpty()
  AI_API_KEY: string;

  /** Cheap model for the map step, which carries the bulk of the tokens. */
  @IsString()
  @IsNotEmpty()
  AI_MODEL_FAST: string;

  /** Stronger model for reduce, propose and brief — once each, quality shows. */
  @IsString()
  @IsNotEmpty()
  AI_MODEL_STRONG: string;

  /** Seed account, created by `pnpm seed`. Never read at runtime. */
  @IsString()
  @IsNotEmpty()
  SEED_ADMIN_EMAIL: string;

  @IsString()
  @IsNotEmpty()
  SEED_ADMIN_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  SEED_ADMIN_NAME: string;

  /**
   * Optional second account, for verifying the member-vs-owner states that the
   * single admin account cannot cover — Clarivo has no signup endpoint, so the
   * seed is the only way to create one. @IsOptional() on purpose: a required
   * var would invalidate every existing .env for a local test fixture. Seeded
   * only when all three are set.
   */
  @IsString()
  @IsOptional()
  SEED_MEMBER_EMAIL?: string;

  @IsString()
  @IsOptional()
  SEED_MEMBER_PASSWORD?: string;

  @IsString()
  @IsOptional()
  SEED_MEMBER_NAME?: string;
}

/** '*' stays a wildcard; anything else becomes the explicit origin list. */
export function corsOrigins(value: string): string | string[] {
  return value === '*'
    ? '*'
    : value
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
}

/**
 * Fails fast at boot: a missing or malformed variable kills the process with a
 * readable list instead of surfacing as a connection error later.
 */
export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
    excludeExtraneousValues: false,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment:\n${errors
        .map((e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }
  return validated;
}
