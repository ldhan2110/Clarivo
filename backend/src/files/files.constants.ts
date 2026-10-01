/**
 * Allowed upload types, mapped to the extension used on disk.
 *
 * The keys ARE the allowlist — there is no second list to fall out of sync.
 * The extension is taken from here rather than from the uploaded filename, so
 * `../../etc/passwd` and `invoice.pdf.exe` cannot influence the stored path.
 *
 * `image/svg+xml` is excluded deliberately: SVG is XML that can carry
 * <script>, so an SVG served from our own origin is stored XSS. Raster images
 * carry no such risk.
 */
export const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** Types shown inline rather than downloaded. Raster only — never SVG. */
export const INLINE_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

/** Upload ceiling. Not an env var: nothing needs to vary it per environment. */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/**
 * Staging directory for in-progress uploads, relative to FILE_STORAGE_PATH.
 * It must live under the storage root: fs.rename is atomic only within one
 * filesystem, and across devices it fails with EXDEV.
 */
export const TMP_DIR = 'tmp';
