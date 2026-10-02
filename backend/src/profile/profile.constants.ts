/**
 * Avatar upload ceiling — 5 MB, well under the 100 MB general file cap. Not an
 * env var: nothing needs to vary it per environment (same reasoning as
 * files.constants.ts MAX_FILE_SIZE_BYTES).
 */
export const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Raster subset of the file allowlist. SVG stays excluded — it is XML that can
 * carry <script>, so an SVG served from our own origin would be stored XSS.
 */
export const AVATAR_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);
