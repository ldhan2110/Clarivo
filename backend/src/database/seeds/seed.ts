// Must come first: database.config validates the env at import time, and
// class-transformer needs the metadata to coerce PORT/DATABASE_PORT to numbers.
import 'reflect-metadata';
import * as argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';
import { validate } from '../../config/env.validation';
import { User } from '../../users/user.entity';
import { normaliseEmail } from '../../users/users.service';
import dataSource from '../data-source';

/**
 * Creates the single administrator account from SEED_ADMIN_* environment
 * variables. Idempotent: reruns update the existing row rather than inserting
 * a second one. No credential is ever committed — the password is read from
 * the environment and hashed here, at run time.
 */
async function seed(): Promise<void> {
  loadEnv();
  const env = validate(process.env as Record<string, unknown>);

  await dataSource.initialize();
  try {
    const users = dataSource.getRepository(User);
    const email = normaliseEmail(env.SEED_ADMIN_EMAIL);
    const passwordHash = await argon2.hash(env.SEED_ADMIN_PASSWORD, {
      type: argon2.argon2id,
    });

    const existing = await users.findOne({ where: { email } });
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.name = env.SEED_ADMIN_NAME;
      await users.save(existing);
      console.log(`seed: updated ${email}`);
    } else {
      await users.save(users.create({ email, passwordHash, name: env.SEED_ADMIN_NAME }));
      console.log(`seed: created ${email}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

void seed().catch((error) => {
  console.error('seed failed:', error);
  process.exitCode = 1;
});
