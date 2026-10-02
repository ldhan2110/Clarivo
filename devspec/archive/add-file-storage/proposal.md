# Proposal: add-file-storage

_approved_by: LE AN_
_approved_at: 2026-10-01_

## Why

Clarivo's product shape is built on documents. A project is given context documents; meetings produce transcripts; requirements trace back to the artifact that produced them. Every one of those flows needs the same thing underneath: take an uploaded file, put the bytes somewhere durable, and hand back a stable id a domain row can point at.

Today the backend has no way to accept a file at all. There is no storage location, no table, no endpoint, and no size or type policy. The first feature that needs an upload would have to invent all five, inline, under deadline — and whatever it invented would become the precedent for every feature after it.

This change builds that layer once, deliberately, with no feature pressure on it.

## What it delivers

A minimal, complete file-storage capability in the backend:

- **A `files` table** — id, relative storage key, original filename, mime type, size, uploader. One row per stored file.
- **`POST /files`** — authenticated multipart upload. Validates type and size, writes the bytes to disk, returns the file's id and metadata.
- **`GET /files/:id`** — authenticated download, streamed through the API so access is always checked.
- **A storage root from configuration** — `FILE_STORAGE_PATH`. The database stores only a relative key, so the storage directory can move between dev, staging and production without touching data.
- **A type allowlist and a size cap** — PDF, DOCX, TXT, MD and raster images, up to 100 MB.
- **Deletion** — removing a file row removes its bytes.

The shape is intentionally conservative: this is infrastructure other changes will build on, so it does the obvious thing in the obvious place.

## Scope

### In

- `files` table + its forward migration
- `FileEntity`, `FilesService`, `FilesController`, `FilesModule`, `FileDto`, `FileErrors`
- `FILE_STORAGE_PATH` added to the env contract (`env.validation.ts` + `.env.example`)
- Mime allowlist, 100 MB cap, extension derived from the validated mime type
- Upload, download, delete
- Unit tests for the service, plus a schema assertion that the migration produced the right columns
- Regenerating `frontend/app/types/api/` (`pnpm api:types`) so the new endpoints appear in the generated types
- Refreshing `devspec/context/schema.md`, which currently claims this project has zero domain tables

### Out

- **Any consumer.** No project-document table, no transcript upload, no screen. Nothing in the frontend calls these endpoints yet. The first feature that needs files adds its own `file_id` column pointing at `files`.
- **Per-file authorization.** ~~Any authenticated user can download any file by id.~~ **CLOSED by add-project-context (2026-10-01):** that change gave files owners, so `GET /files/:id` now requires membership of the owning project when the file has a `project_documents` row. A file with no such row keeps the original behaviour, which is why the pre-existing orphan rows needed no data fix. See `backend/src/files/download-authorisation.spec.ts`.
- **Object storage.** Local disk only. No S3, no MinIO, no storage-driver abstraction behind an interface with one implementation.
- **Image processing.** No thumbnails, no resizing, no EXIF stripping.
- **Versioning, deduplication, checksums, virus scanning, quotas, orphan sweeping.** Each is a real concern and none has a requirement behind it yet.
- **Audio and video.** Not in the allowlist. Meeting recordings would break the premise of local disk plus stream-through-API and are a separate change with a different storage answer.
- **Destructive database operations.** Nothing is dropped, renamed, or backfilled.

## Risks worth stating up front

- **Unreferenced by design.** With no consumer, nothing distinguishes a legitimate file row from one left over from a test. Accepted: the alternative is guessing at a consumer's needs and specifying the wrong ownership model.
- **Flat access control.** "Any authenticated user can read any file" is correct for infrastructure with no owner model and wrong the moment real project documents land. The first consumer must tighten it; nothing in this change enforces that it does.
- **100 MB is large.** It rules out buffering uploads in memory and makes the write path less obvious than it looks. The design addresses this directly.
