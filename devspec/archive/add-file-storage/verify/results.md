# Verify results: add-file-storage

Measured against the running backend on :3000 (`pnpm start:dev`), Postgres on 5437,
logged in as the seeded admin from `devspec/improve/testing.md`. Every value below is
copied from real output, not reasoned about.

## Upload — `POST /files`

| Check | Spec | Measured | |
|---|---|---|---|
| PDF, authenticated | 201 + metadata | `201` · `{"id":"01a0f5a2-33c4-…","originalName":"sample.pdf","mimeType":"application/pdf","sizeBytes":69}` | pass |
| `sizeBytes` is a number | number, not string | `69` unquoted in JSON | pass |
| `storageKey` absent from the body | not exposed | body has only id/createdAt/updatedAt/originalName/mimeType/sizeBytes | pass |
| Bytes on disk | `<base>/<key>` | `storage/2026/10/01a0f5a2-33c4-70be-b734-7dc2f48f9121.pdf` | pass |
| Row written | relative key + uploader | `storage_key = 2026/10/01a0f5a2-….pdf`, `uploaded_by = 01a0f1c1-4729-77d6-a79c-4499da26a8d1` (= JWT `sub`) | pass |
| No cookie | 401, nothing written | `401 UNAUTHORIZED`, no new file, no new row | pass |
| `image/svg+xml` | 415 `FILE_UNSUPPORTED_TYPE` | `415` · `{"code":"FILE_UNSUPPORTED_TYPE","details":{"mimeType":"image/svg+xml"}}` | pass |
| `application/x-msdownload` | 415 `FILE_UNSUPPORTED_TYPE` | `415` · same code, `details.mimeType` echoed | pass |
| 101 MB | 413 `FILE_TOO_LARGE` | `413` · `{"code":"FILE_TOO_LARGE","message":"File exceeds the 100 MB limit"}` | pass |
| 99 MB (under the cap) | accepted | `201` — proves diskStorage streams rather than buffering | pass |
| Extra form field `storageKey` | 400 | `400` · `details: ["property storageKey should not exist"]` | pass **after a fix** — see below |

## Download — `GET /files/:id`

| Check | Spec | Measured | |
|---|---|---|---|
| PDF, authenticated | 200, exact bytes | `200`, `shasum` of the response == `shasum` of the upload | pass |
| `Content-Type` | stored mime | `application/pdf` | pass |
| `Content-Length` | stored size | `69` | pass |
| `X-Content-Type-Options` | always `nosniff` | `nosniff` on both the PDF and the PNG | pass |
| Document disposition | `attachment` | `attachment; filename="sample.pdf"; filename*=UTF-8''sample.pdf` | pass |
| Image disposition | `inline` | `inline; filename="sample.png"; filename*=UTF-8''sample.png` | pass |
| PNG bytes | exact | `shasum` match | pass |
| No cookie | 401 | `401 UNAUTHORIZED` | pass |
| Unknown uuid | 404 `FILE_NOT_FOUND` | `404` · `{"code":"FILE_NOT_FOUND","details":{"id":"01a0f5a3-0000-…"}}` | pass |
| Row present, bytes deleted | 404 + error log | `404 FILE_NOT_FOUND`, and exactly one server line: `File row 01a0f5a3-1d2b-… has no bytes at 2026/10/01a0f5a3-….png` | pass |
| Malformed id | (unspecified) | `400 Validation failed (uuid is expected)` from `ParseUUIDPipe` — never reaches the service | pass |

## Two things the run changed or found

### 1. An extra form field was being ignored, not rejected — fixed

First measurement returned **201**, not the spec'd 400: the handler had no `@Body()`, so
the global `ValidationPipe`'s `forbidNonWhitelisted` was never in the path and the extra
field was silently dropped. The intent held (nothing read the field) but the contract did
not.

Fixed by adding an intentionally empty `UploadFileDto` and `@Body() _body: UploadFileDto`
to the handler. Re-measured: `400` with `property storageKey should not exist`, and a
clean upload still returns 201.

### 2. `original_name` is NOT stored verbatim — the spec clause is wrong

`spec.md` `[req-3]`, scenario "on-disk name ignores the uploaded filename", asserts that
uploading a file named `../../../etc/passwd.pdf` leaves `original_name` holding **that
string verbatim**. It does not.

Measured with a hand-built raw multipart body (curl sanitises `filename=` itself, so the
first attempt was not actually testing the server):

```
Content-Disposition: form-data; name="file"; filename="../../../etc/passwd.pdf"
  → 201, originalName = "passwd.pdf"
```

**multer/busboy reduces the filename to its basename before the application ever sees
it.** Storing the string verbatim is therefore not implementable without hand-parsing the
raw multipart headers, which would be strictly worse.

The security properties the scenario exists to prove both hold, and hold twice over:
- `storage_key` was `2026/10/<uuidv7>.pdf` — generated, extension from the validated mime
  type, never from the name.
- Nothing was written outside `FILE_STORAGE_PATH`.

So this is a wrong assertion in the spec, erring in the safe direction. **It needs a
one-clause amendment** (`original_name` stores the filename multer reports, which is
already basenamed) — run `/devspec-amend add-file-storage`. The worker does not rewrite
specs, so it is flagged, not silently corrected. Logged in
`devspec/report/blockers.md`.

## Dev-environment state left behind

- `backend/storage/` holds ~99 MB across 6 test uploads (gitignored). Clear it by hand if
  the space matters; the `files` rows for them stay until something deletes them.
- One 69-byte orphan in `backend/storage/tmp/` — staged by the request that the 400
  rejected. This is exactly the designed failure mode: orphans collect in one sweepable
  directory rather than scattering through date shards. No sweeper exists yet, by design.
- The PNG row `01a0f5a3-1d2b-…` is deliberately a missing-bytes row now (its file was
  deleted to test the 404 path). Leaving it in place documents that state.
