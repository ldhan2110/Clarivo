# Tasks: add-file-storage

Backend only, plus one generated-types refresh in the frontend. No UI.
Run top to bottom — each section depends only on the ones above it.

## 1. Storage root in the env contract [req-1]
- [x] 1.1 [backend] Add `FILE_STORAGE_PATH: string` to `EnvironmentVariables` (`backend/src/config/env.validation.ts`) with `@IsString()` + `@IsNotEmpty()` and **no default value** — same shape as `JWT_SECRET`. JSDoc comment: it is the absolute root for stored files; the DB holds relative keys only
- [x] 1.2 [backend] Add the matching row to `backend/.env.example`: `FILE_STORAGE_PATH=./storage`
- [x] 1.3 [backend] Add `FILE_STORAGE_PATH=./storage` to the gitignored `backend/.env` — without it the app no longer boots
- [x] 1.4 [backend] Add `backend/storage/` to `.gitignore` so dev uploads are never committed
- [x] 1.5 [test] Extend `backend/src/config/env.validation.spec.ts`: a config missing `FILE_STORAGE_PATH` throws and the message names the variable
Verify: `cd backend && pnpm test src/config/env.validation.spec.ts`

## 2. Constants and domain errors [req-3] [req-6]
- [x] 2.1 [backend] New `backend/src/files/files.constants.ts` — `MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024`, `TMP_DIR = 'tmp'`, and `MIME_EXTENSIONS: Record<string, string>` mapping exactly: `application/pdf`→`.pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`→`.docx`, `text/plain`→`.txt`, `text/markdown`→`.md`, `image/png`→`.png`, `image/jpeg`→`.jpg`, `image/webp`→`.webp`, `image/gif`→`.gif`. The map's keys ARE the allowlist — do not write a second list. Comment that `image/svg+xml` is excluded deliberately (SVG is executable XML)
- [x] 2.2 [backend] New `backend/src/files/files.errors.ts` — one `defineErrors('FILE', {...})` call, copying the shape of `backend/src/auth/auth.errors.ts`: `NOT_FOUND` (404, `'File not found'`), `TOO_LARGE` (413, `'File exceeds the 100 MB limit'`), `UNSUPPORTED_TYPE` (415, `'File type is not supported'`)
- [x] 2.3 [test] New `backend/src/files/files.errors.spec.ts`: each factory produces the right `code` (`FILE_NOT_FOUND` etc.) and status
Verify: `cd backend && pnpm test src/files/files.errors.spec.ts`

## 3. Entity, DTO and migration [req-2]
- [x] 3.1 [db] New `backend/src/files/file.entity.ts` — `@Entity('files') export class FileEntity extends BaseEntity` with `@Column({ name: 'storage_key', type: 'varchar', length: 255, unique: true }) storageKey`, `@Column({ name: 'original_name', type: 'varchar', length: 255 }) originalName`, `@Column({ name: 'mime_type', type: 'varchar', length: 127 }) mimeType`, `@Column({ name: 'size_bytes', type: 'int' }) sizeBytes`, `@Column({ name: 'uploaded_by', type: 'uuid' }) uploadedBy` plus `@ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'uploaded_by' })`. Class is `FileEntity`, not `File` (`File` is a Node global). Every column needs an explicit `name:` — there is no naming strategy configured. Add a `ponytail:` comment on `sizeBytes` (int not bigint, ~2 GB ceiling) and one on `uploadedBy` (no index until a per-uploader listing or user-delete path exists)
- [x] 3.2 [backend] New `backend/src/files/dto/file.dto.ts` — `FileDto extends AuditDto` with `@Expose()` on `originalName`, `mimeType`, `sizeBytes` only. **`storageKey` and `uploadedBy` get no `@Expose()`** — that is what keeps the storage layout and the uploader out of responses
- [x] 3.3 [db] Generate the migration: `cd backend && pnpm migration:generate src/database/migrations/CreateFiles`. **Read the emitted SQL** — confirm one `CREATE TABLE "files"`, the unique constraint on `storage_key`, the FK with `ON DELETE RESTRICT`, and that nothing touches `users`
- [x] 3.4 [db] Apply it: `pnpm migration:run`, then `pnpm migration:revert` and `pnpm migration:run` again to prove it reverts clean
- [x] 3.5 [test] New `backend/src/files/file.entity.spec.ts`: constructing a `FileEntity` and calling `generateId()` yields a v7 uuid; the entity's declared metadata maps `storageKey` → column `storage_key` (guards against a forgotten `name:`)
Verify: `cd backend && pnpm test src/files && docker exec clarivo-postgres-1 psql -U postgres -d clarivo -c "\d files" -c "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='files'::regclass;"` — all 8 columns present with the types in `db.md`, `size_bytes` is `integer`, unique on `storage_key`, FK to `users(id)` `ON DELETE RESTRICT`

## 4. FilesService [req-3] [req-4] [req-5]
- [ ] 4.1 [service] New `backend/src/files/files.service.ts` — `@Injectable() FilesService`, constructor takes `@InjectRepository(FileEntity)` and `ConfigService<EnvironmentVariables, true>`. Private `baseDir` read once via `config.get('FILE_STORAGE_PATH', { infer: true })`; private `absolute(key)` = `join(baseDir, key)`. Use `node:` prefixed imports (`node:fs/promises`, `node:path`, `node:fs`) per `conventions.md`
- [ ] 4.2 [service] `onModuleInit()` — `mkdir(baseDir, { recursive: true })` and `mkdir(join(baseDir, TMP_DIR), { recursive: true })`. Let a failure propagate so boot dies rather than starting with an unusable write path
- [ ] 4.3 [service] `store(file: Express.Multer.File, uploaderId: string): Promise<FileEntity>` — derive the extension from `MIME_EXTENSIONS[file.mimetype]` (throw `FileErrors.UNSUPPORTED_TYPE()` if absent, as a second line of defence behind the fileFilter); build `id = uuidv7()`; `key = ${yyyy}/${mm}/${id}${ext}` from the current date; `mkdir` the shard; `rename(file.path, absolute(key))`; then insert the row with that same `id`, `key`, `file.originalname`, `file.mimetype`, `file.size`, `uploaderId`. Bytes move **before** the insert — a crash between the two leaves a sweepable orphan, not a row that 404s
- [ ] 4.4 [service] On any failure after the rename, `unlink` the moved file before rethrowing, so a failed insert does not leave a shard orphan
- [ ] 4.5 [service] `findById(id): Promise<FileEntity>` — throw `FileErrors.NOT_FOUND()` when there is no row
- [ ] 4.6 [service] `createStream(file: FileEntity): ReadStream` — `existsSync(absolute(key))` first; if the bytes are gone, `logger.error` the id and key, then throw `FileErrors.NOT_FOUND()` (not a 500 — a retry can never succeed)
- [ ] 4.7 [service] `remove(id): Promise<void>` — `findById`, delete the row, then `unlink`. Wrap the `unlink` in try/catch and `logger.warn` on failure; never rethrow, the row is already gone
- [ ] 4.8 [test] New `backend/src/files/files.service.spec.ts` against a temp dir as `FILE_STORAGE_PATH` and a mocked repository: store writes to `yyyy/mm/<id><ext>` and the key is relative; an unknown mime throws `UNSUPPORTED_TYPE`; an original name of `../../../etc/passwd.pdf` yields a key of `yyyy/mm/<id>.pdf` and writes nothing outside the temp dir; `findById` on a missing row throws `NOT_FOUND`; `createStream` on a row whose file is deleted throws `NOT_FOUND` and logs; `remove` deletes the row and tolerates a missing file
Verify: `cd backend && pnpm test src/files/files.service.spec.ts`

## 5. FilesController and FilesModule [req-3] [req-4] [req-6]
- [ ] 5.1 [backend] New `backend/src/files/files.controller.ts` — `@Controller('files')`, both routes `@UseGuards(JwtAuthGuard)` + `@ApiCookieAuth(SESSION_COOKIE)`. A local `toFileDto` helper using `plainToInstance(FileDto, entity, { excludeExtraneousValues: true })`, copying `toUserDto` in `backend/src/auth/auth.controller.ts`
- [ ] 5.2 [backend] `POST /files` → `@UseInterceptors(FileInterceptor('file', { storage: diskStorage({ destination: <base>/tmp }), limits: { fileSize: MAX_FILE_SIZE_BYTES }, fileFilter: <reject mime not in MIME_EXTENSIONS> }))`. **`diskStorage`, never the default `memoryStorage`** — 100 MB in RAM per concurrent upload. The temp dir must be under `FILE_STORAGE_PATH` so the later `rename` stays on one filesystem (cross-device `rename` fails `EXDEV`). Handler reads `@UploadedFile() file` and `@Req() req` (`req.user as User` for the uploader id, as `AuthController.me` does), calls `FilesService.store`, returns `FileDto`. Add `@ApiConsumes('multipart/form-data')` + `@ApiBody` with the binary schema — multipart is the one case the Swagger CLI plugin cannot infer
- [ ] 5.3 [backend] Translate multer's rejections into the domain errors: `LIMIT_FILE_SIZE` → `FileErrors.TOO_LARGE()` (413), a `fileFilter` rejection → `FileErrors.UNSUPPORTED_TYPE()` (415). Simplest route is for `fileFilter` to pass the domain error to its callback; verify the status and `code` that actually reach the client, since `AppExceptionFilter` only maps what reaches it
- [ ] 5.4 [backend] `GET /files/:id` → `findById`, then return `new StreamableFile(createStream(file))`. Set via `@Res({ passthrough: true })`: `Content-Type` = stored mime, `Content-Length` = stored size, `X-Content-Type-Options: nosniff` always, and `Content-Disposition` = `inline` for `image/png|image/jpeg|image/webp|image/gif`, `attachment` otherwise — with the original filename quoted and RFC 5987-encoded. **Open question in `design.md`**: if the answer is uniform `attachment`, change only this helper and the `[req-4]` image scenario
- [ ] 5.5 [backend] New `backend/src/files/files.module.ts` — `TypeOrmModule.forFeature([FileEntity])`, declares the controller and service, exports `FilesService` for future consumers. `app.module.ts` uses `entities: []` + `autoLoadEntities: true`, so `forFeature` here is the **only** thing that registers the entity
- [ ] 5.6 [backend] Register `FilesModule` in `backend/src/app.module.ts` imports, after `AuthModule`
- [ ] 5.7 [backend] Add `@types/multer` as a dev dependency (`pnpm add -D @types/multer`) — `@nestjs/platform-express` bundles multer but ships no types, so `Express.Multer.File` will not typecheck without it
Verify: `cd backend && pnpm build && pnpm lint && pnpm test src/files` — all clean. Do **not** run `pnpm test:e2e`: `test/app.e2e-spec.ts` is a pre-existing failure unrelated to this change (see `devspec/report/blockers.md`)

## 6. Prove it against the running API [req-3] [req-4] [req-6]
- [ ] 6.1 [test] Start the backend (`pnpm start:dev`) and log in to get a session cookie: `curl -i -c /tmp/clarivo.jar -X POST localhost:3000/auth/login -H 'content-type: application/json' -d '{"email":"admin@clarivo.local","password":"Clarivo!2026","remember":false}'` (credentials from `devspec/improve/testing.md`)
- [ ] 6.2 [test] Upload a PDF with the cookie → 201, body has `id`/`originalName`/`mimeType`/`sizeBytes` and **no** `storageKey`. Confirm the bytes landed at `backend/storage/<yyyy>/<mm>/<id>.pdf` and the row's `storage_key` matches
- [ ] 6.3 [test] Upload with **no** cookie → 401, and nothing new appears under `backend/storage/` or in `files`
- [ ] 6.4 [test] Upload a `.svg` and an `.exe` → both 415 with `code: FILE_UNSUPPORTED_TYPE`
- [ ] 6.5 [test] Upload a 101 MB file (`mkfile 101m` or `dd`) → 413 with `code: FILE_TOO_LARGE`, and no row inserted
- [ ] 6.6 [test] Upload a PDF named `../../../etc/passwd.pdf` → 201; `original_name` holds the string verbatim, `storage_key` is `yyyy/mm/<id>.pdf`, and nothing exists outside `backend/storage/`
- [ ] 6.7 [test] `GET /files/<id>` with the cookie → 200, bytes identical to the upload (`shasum` both), `content-type` correct, `x-content-type-options: nosniff` present, `content-disposition: attachment` for the PDF
- [ ] 6.8 [test] Upload a PNG and `GET` it → `content-disposition: inline`, `nosniff` still present
- [ ] 6.9 [test] `GET /files/<id>` with no cookie → 401. `GET` a random uuid → 404 `FILE_NOT_FOUND`. Delete a file's bytes from disk by hand, `GET` it → 404 `FILE_NOT_FOUND` and an error line in the server log
- [ ] 6.10 [test] Record the measured results (status codes, headers, paths) in `devspec/changes/add-file-storage/verify/results.md`
Verify: every curl above returns the status and `code` named in `spec.md` — paste the measured output into `verify/results.md`, do not assert from reasoning

## 7. Sync the frontend types and the context pack [req-7]
- [ ] 7.1 [frontend] With the backend running, `cd frontend && pnpm api:types`. Confirm `frontend/app/types/api/` gains the `/files` and `/files/{id}` operations plus the `FileDto` shape. **Never hand-edit that folder**
- [ ] 7.2 [frontend] `cd frontend && npx tsc --noEmit && pnpm lint` — clean. No frontend source changes in this task; the regenerated types must not break any existing call site
- [ ] 7.3 Update `devspec/context/schema.md`: it claims zero domain tables. Record `users` **and** `files` as they now exist, and fill in the "Not yet established" section with what these two tables actually settled — table names plural lowercase, FK column `<entity>_by`/`<entity>_id` snake_case, `ON DELETE RESTRICT` as the default, no soft delete, no enum tables yet
Verify: `cd frontend && npx tsc --noEmit && pnpm lint` clean, and `git diff --stat frontend/app/types/api` shows only generated additions
