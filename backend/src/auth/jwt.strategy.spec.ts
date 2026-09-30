import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from './auth.constants';
import { cookieExtractor } from './jwt.strategy';

describe('cookieExtractor', () => {
  it('reads the session cookie', () => {
    expect(cookieExtractor({ cookies: { [SESSION_COOKIE]: 'tok' } } as never)).toBe('tok');
  });

  it('returns null when the cookie is absent', () => {
    expect(cookieExtractor({ cookies: {} } as never)).toBeNull();
  });

  it('returns null when cookie-parser did not run', () => {
    expect(cookieExtractor({} as never)).toBeNull();
  });
});
