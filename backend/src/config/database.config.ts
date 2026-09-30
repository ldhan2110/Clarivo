import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import type { DataSourceOptions } from 'typeorm';
import { validate } from './env.validation';

// Loaded here, not only by ConfigModule: the TypeORM CLI boots outside Nest.
loadEnv();
const env = validate(process.env as Record<string, unknown>);
const root = join(__dirname, '..');

/** Single source of DB config — used by TypeOrmModule.forRoot and the CLI DataSource. */
export const databaseOptions: DataSourceOptions = {
  type: 'postgres',
  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT,
  username: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
  schema: env.DATABASE_SCHEMA,
  // Both extensions so the globs resolve from src/ under vitest and dist/ at runtime.
  entities: [join(root, '**/*.entity{.ts,.js}')],
  migrations: [join(root, 'database/migrations/*{.ts,.js}')],
  migrationsTableName: 'migrations',
  // Migrations are the only way the schema changes, in every environment.
  synchronize: false,
  logging: env.NODE_ENV === 'development' ? ['error', 'warn', 'migration'] : ['error'],
};
