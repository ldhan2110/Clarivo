/**
 * Plain module on purpose — the server layout reads this name via
 * next/headers cookies(). Exporting it from the "use client" context module
 * hands the server a client-reference proxy instead of the string, and the
 * cookie lookup silently misses.
 */
export const SIDEBAR_COOKIE = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
