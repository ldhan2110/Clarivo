# Spec: add-file-storage

Behavior contract. Design rationale is in `design.md`; the schema is in `db.md`.

### Requirement: storage root configuration [req-1]
The backend SHALL read its storage root from a required environment variable and SHALL NOT boot without it.

#### Scenario: variable missing
- **WHEN** the backend starts with no `FILE_STORAGE_PATH` in the environment
- **THEN** boot fails with a validation error naming `FILE_STORAGE_PATH`
- **AND** no code-level default silently substitutes a path

#### Scenario: variable set, directory absent
- **WHEN** the backend starts with `FILE_STORAGE_PATH` pointing at a directory that does not exist
- **THEN** the directory and its `tmp` subdirectory are created
- **AND** boot succeeds

#### Scenario: directory cannot be created
- **WHEN** `FILE_STORAGE_PATH` points somewhere the process cannot write
- **THEN** boot fails loudly rather than starting with an unusable write path

### Requirement: files table [req-2]
The database SHALL have a `files` table recording one row per stored file, with a relative storage key and the user who uploaded it.

#### Scenario: migration applies
- **WHEN** the forward migration runs against a database holding only `users`
- **THEN** `files` exists with `id`, `created_at`, `updated_at`, `storage_key`, `original_name`, `mime_type`, `size_bytes`, `uploaded_by`
- **AND** `storage_key` carries a unique constraint
- **AND** `uploaded_by` is a foreign key to `users(id)` with `ON DELETE RESTRICT`
- **AND** no column on `users` is added, altered or dropped

#### Scenario: migration reverts
- **WHEN** the migration is reverted
- **THEN** `files` is dropped and `users` is untouched

#### Scenario: size is a number, not a string
- **WHEN** a stored row is read back through the repository
- **THEN** `sizeBytes` is a JavaScript `number`

#### Scenario: key is relative
- **WHEN** any row is inserted
- **THEN** `storage_key` is a relative path of the form `yyyy/mm/<id><ext>` and contains no absolute path segment

### Requirement: authenticated upload [req-3]
The API SHALL accept a multipart upload from an authenticated user, store the bytes under the storage root, and return the file's metadata.

#### Scenario: accepted upload
- **WHEN** an authenticated user `POST`s a 1 MB PDF to `/files`
- **THEN** the response is 201 with `{ id, originalName, mimeType, sizeBytes, createdAt, updatedAt }`
- **AND** a `files` row exists with `uploaded_by` set to that user's id
- **AND** the bytes exist on disk at `<FILE_STORAGE_PATH>/<storage_key>`
- **AND** the response body contains no `storageKey` and no absolute path

#### Scenario: unauthenticated upload
- **WHEN** an upload is sent with no session cookie
- **THEN** the response is 401 and nothing is written to disk or to the database

#### Scenario: disallowed type
- **WHEN** an authenticated user uploads a file declaring `application/x-msdownload`
- **THEN** the response is 415 with code `FILE_UNSUPPORTED_TYPE`
- **AND** no row is inserted

#### Scenario: SVG is rejected
- **WHEN** an authenticated user uploads a file declaring `image/svg+xml`
- **THEN** the response is 415 with code `FILE_UNSUPPORTED_TYPE`

#### Scenario: oversize upload
- **WHEN** an authenticated user uploads a file larger than 100 MB
- **THEN** the response is 413 with code `FILE_TOO_LARGE`
- **AND** no row is inserted

#### Scenario: on-disk name ignores the uploaded filename
- **WHEN** a PDF is uploaded with the original name `../../../etc/passwd.pdf`
- **THEN** `original_name` stores that string verbatim
- **AND** `storage_key` is `yyyy/mm/<id>.pdf` with the extension taken from the mime type
- **AND** nothing is written outside `FILE_STORAGE_PATH`

#### Scenario: no field is accepted beyond the file
- **WHEN** an upload includes an extra form field such as `storageKey`
- **THEN** the request is rejected with 400 by the global validation pipe rather than the field being used

### Requirement: authenticated download [req-4]
The API SHALL stream a stored file to an authenticated caller and SHALL NOT serve files outside an authenticated request.

#### Scenario: successful download
- **WHEN** an authenticated user `GET`s `/files/:id` for an existing file
- **THEN** the response is 200 with the exact stored bytes
- **AND** `Content-Type` is the stored mime type
- **AND** `Content-Length` is the stored size
- **AND** `X-Content-Type-Options: nosniff` is present
- **AND** `Content-Disposition` carries the original filename

#### Scenario: unauthenticated download
- **WHEN** `/files/:id` is requested with no session cookie
- **THEN** the response is 401 and no bytes are sent

#### Scenario: unknown id
- **WHEN** an authenticated user requests an id with no matching row
- **THEN** the response is 404 with code `FILE_NOT_FOUND`

#### Scenario: row exists but bytes are gone
- **WHEN** a row's file is missing from disk
- **THEN** the response is 404 with code `FILE_NOT_FOUND`
- **AND** the inconsistency is logged at error level

#### Scenario: image disposition
- **WHEN** a stored `image/png` is downloaded
- **THEN** `Content-Disposition` is `inline`
- **AND** `nosniff` is still present

#### Scenario: document disposition
- **WHEN** a stored PDF or DOCX is downloaded
- **THEN** `Content-Disposition` is `attachment`

### Requirement: deletion removes row and bytes [req-5]
Deleting a file SHALL remove both its database row and its bytes, and SHALL NOT fail because the bytes were already gone.

#### Scenario: delete an existing file
- **WHEN** `FilesService.remove` is called with an existing id
- **THEN** the row is deleted and the file no longer exists on disk

#### Scenario: bytes already missing
- **WHEN** `remove` is called for a row whose file is absent from disk
- **THEN** the row is still deleted
- **AND** the unlink failure is logged, not thrown

#### Scenario: unknown id
- **WHEN** `remove` is called with an id that has no row
- **THEN** it raises `FILE_NOT_FOUND`

### Requirement: errors follow the project envelope [req-6]
Every failure SHALL use the project's domain-error mechanism and emerge in the standard error envelope.

#### Scenario: error shape
- **WHEN** any file operation fails
- **THEN** the response body is `{ statusCode, code, message, path, timestamp }` with `code` one of `FILE_NOT_FOUND`, `FILE_TOO_LARGE`, `FILE_UNSUPPORTED_TYPE`
- **AND** the error originates from a single `defineErrors('FILE', {...})` declaration, not a raw `HttpException`

### Requirement: generated frontend types stay in sync [req-7]
The frontend's generated API types SHALL include the new endpoints.

#### Scenario: types regenerated
- **WHEN** `pnpm api:types` runs in `frontend/` against the running backend
- **THEN** `frontend/app/types/api/` includes the `/files` and `/files/{id}` operations and the `FileDto` shape
- **AND** `npx tsc --noEmit` in `frontend/` is clean
