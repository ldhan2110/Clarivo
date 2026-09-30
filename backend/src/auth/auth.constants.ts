/** Session cookie name. Referenced by the controller, the JWT strategy, the
 *  Swagger security scheme and the frontend middleware — keep them in sync. */
export const SESSION_COOKIE = 'clv_at';

/** "Remember me" lifetime. Unchecked omits maxAge entirely → session cookie. */
export const REMEMBER_ME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
