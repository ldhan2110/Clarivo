import { Transform, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
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
