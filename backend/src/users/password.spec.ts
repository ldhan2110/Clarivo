import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password helper', () => {
  it('produces an argon2id hash that verifies against the original', async () => {
    const hash = await hashPassword('correct-horse');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(hash, 'correct-horse')).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-horse');
    await expect(verifyPassword(hash, 'battery-staple')).resolves.toBe(false);
  });
});
