# Design: add-file-storage

Scope and rationale: `proposal.md`. Live schema and migration verdict: `db.md`.

## Architecture

```
Upload
  Client ──POST /files (multipart)──▶ FilesController
                                         │ FileInterceptor (multer, diskStorage → <base>/tmp/)
                                         │   fileFilter: mime allowlist · limits: 100MB
                                         ▼
                                      FilesService.store()
                                         │ 1. key = yyyy/mm/<uuidv7><ext>   ext from validated mime
                                         │ 2. mkdir -p <base>/yyyy/mm
                                         │ 3. fs.rename(<base>/tmp/<rand>, <base>/<key>)   ← atomic, same FS
                                         │ 4. INSERT files row (uploaded_by = req.user.id)
                                         ▼
                                      FileDto { id, originalName, mimeType, sizeBytes, createdAt, ... }

Download
  Client ──GET /files/:id──▶ JwtAuthGuard ──▶ FilesController
                                                 │ FilesService.read(id) → row, else FILE_NOT_FOUND
                                                 │ resolve <base>/<storage_key>
                                                 ▼
                                              createReadStream ──▶ StreamableFile
                                                 headers: Content-Type, Content-Length,
                                                          Content-Disposition, X-Content-Type-Options: nosniff
```

`FILE_STORAGE_PATH` is read once through `ConfigService` and is the only place an absolute path exists. The database holds relative keys exclusively.

## Chosen approach

### Relative key in the DB, absolute base in the environment
`files.storage_key` is `2026/10/019a....pdf`. The absolute path is `join(FILE_STORAGE_PATH, storage_key)`, computed at read time. Moving the storage directory, pointing staging at a different volume, or restoring a backup to a new path is then a config change, not a data migration. Storing absolute paths is the mistake this avoids, and it is expensive to undo once rows exist.

### Date-sharded keys
`yyyy/mm/<uuidv7><ext>`. uuidv7 is already time-sortable, so sharding by the same clock keeps files written together physically together, and no single directory accumulates every file the system has ever stored. The shard costs one `mkdir -p` per upload.

### Extension derived from the validated mime type, never from the upload
The client's filename is stored in `original_name` for display and is never used to build a path. The on-disk extension comes from a lookup table keyed by the allowlisted mime type. This removes the entire class of path-traversal and double-extension attacks rather than trying to sanitize them: `../../etc/passwd` and `invoice.pdf.exe` cannot influence the path because the path is generated, not accepted.

### multer `diskStorage`, not `memoryStorage`
Nest's `FileInterceptor` defaults to `memoryStorage`, which buffers the whole upload in RAM. At a 100 MB cap, a handful of concurrent uploads would exhaust the heap. `diskStorage` streams to a temp file instead.

The temp directory is `<FILE_STORAGE_PATH>/tmp`, **not** the OS temp dir. `fs.rename` is atomic only within a single filesystem; across devices it fails with `EXDEV`, and the fallback (copy then unlink) is neither atomic nor cheap for 100 MB. Keeping temp under the storage root guarantees same-filesystem renames.

### Write the bytes, then insert the row
Two orderings, two failure modes. A crash between the two steps either leaves bytes with no row (an orphan file: invisible, wastes disk, sweepable) or a row with no bytes (a download that 404s: user-facing, and the row looks valid). The orphan file is the gentler failure, so the bytes go first.

Because multer has already written to `<base>/tmp` before the service runs, a failure during validation or insert leaves the orphan in **one sweepable directory** rather than scattered through date shards. A sweeper is not part of this change; the shape just makes one trivial to add.

### Streaming download through the API, not static serving
`ServeStaticModule` or an nginx alias would make every file publicly readable by anyone who can guess or leak a URL. Clarivo's files are project documents. Downloads therefore go through a controller behind `JwtAuthGuard` and return a `StreamableFile` over `fs.createReadStream`, so the bytes are never buffered and access always passes a guard.

`X-Content-Type-Options: nosniff` is sent on every response. Combined with the allowlist excluding SVG, this is what prevents a stored file from being interpreted as executable content by the browser.

### `image/svg+xml` is excluded on purpose
SVG is XML that can carry `<script>`. Served inline from the API's origin, a malicious SVG is stored XSS against Clarivo itself. Raster images carry no such risk. SVG stays out of the allowlist; if a product requirement ever needs it, the answer is sanitization plus a separate origin, not a one-line allowlist edit.

### Trusting the declared mime type
The `Content-Type` a browser sends is client-controlled and can lie. Magic-byte sniffing would detect the lie, and is deliberately not done here. The defense that actually matters is never letting the browser execute the bytes — `nosniff`, no SVG, and generated extensions — all of which hold regardless of whether the declared type was honest. A lying client can only mislabel its own file.

### `integer` for `size_bytes`
TypeORM returns a Postgres `bigint` as a JavaScript **string**, which would flow silently into `FileDto` and out of the API as `"1048576"`. `integer` caps at ~2 GB, twenty times the 100 MB limit, and returns a real number. The ceiling is recorded in a `ponytail:` comment on the column.

### Hard delete
The repository has no soft delete anywhere, and this change does not introduce the concept. `remove()` deletes the row and unlinks the file. An `unlink` failure is logged and swallowed, not thrown: the row is already gone, so throwing would report failure for an operation that mostly succeeded and tempt a caller into retrying a delete that cannot be retried. The cost is a possible orphan file — the same failure mode the write path already tolerates.

### No storage abstraction
No `StorageDriver` interface, no S3 adapter, no `STORAGE_BACKEND` switch. One implementation behind an interface is indirection without benefit. `FilesService` is the seam: if object storage is ever needed, its three filesystem calls are what change, and nothing above it moves.

## Rejected approaches

| Rejected | Why |
|---|---|
| **Absolute path in the DB** | Welds the data to one machine's layout. Changing the mount becomes an UPDATE across every row. |
| **Polymorphic owner (`owner_type` + `owner_id`)** | Looks generic, gives up foreign keys entirely. Every lookup becomes a string comparison with no referential integrity, and nothing stops an `owner_type` typo. Consumers point at `files` with a real FK instead. |
| **Bytes in the database (`bytea`)** | Bloats the table and every backup, defeats streaming, and makes a 100 MB upload a 100 MB transaction. |
| **`ServeStaticModule` for downloads** | Unauthenticated reads of confidential documents. |
| **`memoryStorage` + a smaller cap** | Would make the write path simpler by making the product worse. The 100 MB cap is a requirement. |
| **Storage-driver abstraction now** | Speculative. One implementation, one interface, zero callers. |
| **SHA-256 dedup** | Means hashing 100 MB on every upload for a benefit nobody has asked for. The column can be added later; dedup cannot be retrofitted onto existing rows, which is an accepted cost. |
| **Soft delete on `files`** | Inconsistent with every other table, and "deleted" rows whose bytes are gone are worse than no row at all. |
| **An owner column on `files`** | Would require guessing whether files belong to projects, meetings or users before any of those tables exists. |

## Open question

**`Content-Disposition: inline` for images, `attachment` for everything else — or `attachment` uniformly?**

The spec below is written for the mixed behavior: `inline` for `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `attachment` for PDF, DOCX, TXT and MD. This is what lets a future screen do `<img src="/files/:id">` without a second endpoint.

This was raised in exploration and **not answered**. It is safe either way — SVG is excluded and `nosniff` is always sent, so `inline` cannot yield script execution. If the preference is uniform `attachment`, it is a one-line change to the header helper plus the scenario in `[req-4]`; nothing else in the design depends on it.

## Impact Area

### Decision Defaults

| Gray area | Default decision | Fallback if default doesn't fit |
|-----------|------------------|---------------------------------|
| Module placement | `backend/src/files/` with `dto/` beneath it — mirrors `src/users/` and `src/auth/` exactly (`conventions.md`: role-first at `src/` top level, domain modules set their own folder) | mirror `src/users/` file-for-file |
| File names | `file.entity.ts`, `files.service.ts`, `files.controller.ts`, `files.module.ts`, `files.errors.ts`, `dto/file.dto.ts` — kebab-case + role suffix | — |
| Entity class name | `FileEntity`, **not** `File` — `File` is a DOM/Node global and shadowing it in a file that also handles uploads is a readability trap. Table name stays `files` | `File` with an explicit import alias if `FileEntity` reads worse in context |
| Where the entity is registered | `TypeOrmModule.forFeature([FileEntity])` inside `FilesModule` only — `app.module.ts` uses `entities: []` + `autoLoadEntities: true` on purpose (`db.md`) | — |
| Error declaration | one `defineErrors('FILE', {...})` call in `files.errors.ts`, codes `FILE_NOT_FOUND` / `FILE_TOO_LARGE` / `FILE_UNSUPPORTED_TYPE`, mirroring `auth.errors.ts` | — |
| Error copy tone | sentence case, no trailing period, no detail that leaks internals — matches `AuthErrors` (`'Incorrect email or password'`) | terse lowercase |
| Where the allowlist lives | a `const MIME_EXTENSIONS: Record<string, string>` in `files.constants.ts`, mirroring `auth.constants.ts`. The keys are the allowlist and the values are the extensions — one source of truth, not two lists that can disagree | inline in `files.service.ts` if a separate constants file feels thin |
| How the cap is expressed | a named constant `MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024` in `files.constants.ts`, passed to multer `limits.fileSize`. **Not** an env var — no requirement to vary it per environment | promote to the env contract only if a requirement to vary it appears |
| Identifying the uploader | `req.user as User` after `JwtAuthGuard`, exactly as `AuthController.me` does (`auth.controller.ts`) — there is no `@CurrentUser` decorator in this repo and this change does not add one | — |
| Response serialization | `plainToInstance(FileDto, entity, { excludeExtraneousValues: true })`, the `toUserDto` shape from `auth.controller.ts` | — |
| Swagger annotation | JSDoc comments on each handler (the CLI plugin has `introspectComments: true`, so `@ApiProperty` is rarely needed), plus `@ApiCookieAuth(SESSION_COOKIE)` and the `@ApiConsumes('multipart/form-data')` + `@ApiBody` pair that multipart genuinely does require | — |
| Oversize upload rejection | multer's `limits.fileSize` rejects before the full body is read; translate its `LIMIT_FILE_SIZE` error to `FileErrors.TOO_LARGE()` → 413 | if intercepting multer's error proves awkward, check `file.size` in the service and return the same code — the status and body must match either way |
| Unsupported type rejection | multer `fileFilter` rejects → `FileErrors.UNSUPPORTED_TYPE()` → 415 | same shape, checked in the service |
| Missing file on disk but row present | `FILE_NOT_FOUND` (404) and log at error level — the inconsistency is a server fault, but a 500 tells the client to retry something that will never succeed | — |
| Storage root does not exist at boot | create it with `mkdir -p` on module init. Env validation proves the var is *set*, not that the directory exists | fail boot loudly if creation fails — a write-path that cannot work must not start |
| `uploaded_by` index | omit, with a `ponytail:` comment naming the ceiling (per-uploader listing, or a user-delete path) — see `db.md` | add `@Index()` the moment either ships |
| Tests | vitest spec files **next to the source** (`files.service.spec.ts`), per `conventions.md` — not under `test/` | — |
| `test/app.e2e-spec.ts` is red | **do not touch it.** It is a pre-existing failure that blocks `add-login` (asserts `GET /` → "Hello World!" against a controller this repo does not have). Out of scope; `pnpm test` is the gate for this change, not `pnpm test:e2e` | — |

### Blast Radius

```
backend/src/files/file.entity.ts                        (new)      — safe/reversible
backend/src/files/files.service.ts                      (new)      — safe/reversible
backend/src/files/files.controller.ts                   (new)      — safe/reversible
backend/src/files/files.module.ts                       (new)      — safe/reversible
backend/src/files/files.errors.ts                       (new)      — safe/reversible
backend/src/files/files.constants.ts                    (new)      — safe/reversible
backend/src/files/dto/file.dto.ts                       (new)      — safe/reversible
backend/src/files/files.service.spec.ts                 (new)      — safe/reversible
backend/src/database/migrations/<ts>-CreateFiles.ts     (new)      — safe/reversible (additive, forward-only, reverts clean)
backend/src/config/env.validation.ts                    (adjust)   — safe/reversible  ← SHARED: adds FILE_STORAGE_PATH; a bad default kills boot for every dev
backend/.env.example                                    (adjust)   — safe/reversible
backend/.env                                            (adjust)   — gitignored, dev-local; must gain the var or the app will not boot
backend/package.json                                    (adjust)   — safe/reversible (adds @types/multer, dev dep)
backend/src/app.module.ts                               (adjust)   — safe/reversible  ← SHARED: registers FilesModule, one import line
frontend/app/types/api/**                               (regen)    — safe/reversible (generated; never hand-edited)
devspec/context/schema.md                               (adjust)   — safe/reversible (doc; currently stale)
.gitignore                                              (adjust)   — safe/reversible (ignore the dev storage dir)
```

**Nothing reads or writes `users` differently.** The only touch is a new inbound FK. `UsersService` and `AuthService` are unaffected.

**No existing endpoint changes.** `POST /auth/login`, `POST /auth/logout` and `GET /auth/me` are untouched, so no frontend call site breaks — but `pnpm api:types` must still be rerun, because the generated types are a whole-schema snapshot.

**Zero callers for the new endpoints.** The blast radius of a mistake inside `files/` is confined to `files/` until a consumer exists. The two genuinely shared files are `env.validation.ts` (a bad validator stops every developer's boot) and `app.module.ts` (one import line). Those are where a reviewer should look hardest.

### Risk notes

- `env.validation.ts` is the one change that can break an unrelated developer: adding a required variable means every existing `.env` is now invalid until the var is added. The `.env.example` row and a line in the change's commit message are what make that survivable. This is the same cost `JWT_SECRET` already imposes, and is consistent with `rules.md` ("env vars are validated at boot and the process dies on a bad one").
- The migration is additive and reverts cleanly, so it is `safe/reversible` — but it is only the **second** migration this repo has ever run, and `pnpm migration:*` builds first and runs against `dist/`, so a TypeScript error surfaces as a confusing migration failure. Compile clean before generating.
- **No destructive database operation anywhere in this change.** Nothing is dropped, truncated, renamed or backfilled.
