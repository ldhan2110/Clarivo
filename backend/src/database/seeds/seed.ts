// Must come first: database.config validates the env at import time, and
// class-transformer needs the metadata to coerce PORT/DATABASE_PORT to numbers.
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { validate } from '../../config/env.validation';
import { User } from '../../users/user.entity';
import dataSource from '../data-source';
import { memberAccount, upsertAccount } from './seed.helpers';

/**
 * Creates the administrator account from SEED_ADMIN_* environment variables,
 * plus an optional second account from SEED_MEMBER_* when all three of those
 * are set. Idempotent: reruns update the existing rows rather than inserting
 * second ones. No credential is ever committed — passwords are read from the
 * environment and hashed here, at run time.
 */
async function seed(): Promise<void> {
  loadEnv();
  const env = validate(process.env as Record<string, unknown>);

  await dataSource.initialize();
  try {
    const users = dataSource.getRepository(User);
    const admin = await upsertAccount(users, {
      email: env.SEED_ADMIN_EMAIL,
      password: env.SEED_ADMIN_PASSWORD,
      name: env.SEED_ADMIN_NAME,
    });
    console.log(`seed: ${admin} ${env.SEED_ADMIN_EMAIL}`);

    const member = memberAccount(env);
    if (member) {
      const outcome = await upsertAccount(users, member);
      console.log(`seed: ${outcome} ${member.email}`);
    } else {
      console.log('seed: SEED_MEMBER_* not fully set, skipping the second account');
    }
  } finally {
    await dataSource.destroy();
  }
}

void seed().catch((error) => {
  console.error('seed failed:', error);
  process.exitCode = 1;
});
