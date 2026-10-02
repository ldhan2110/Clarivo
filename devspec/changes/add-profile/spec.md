# Spec: add-profile

### Requirement: avatar column on users [req-1]
The `users` table SHALL carry a nullable `avatar_file_id` referencing `files(id)` with ON DELETE RESTRICT, and the user entity SHALL map it as `avatarFileId`.

#### Scenario: migration applies
- **WHEN** the migration runs against a database with the existing `users` table
- **THEN** `users` has an `avatar_file_id uuid` NULL column with an FK to `files(id)` ON DELETE RESTRICT, and the two existing user rows have `avatar_file_id = NULL`

#### Scenario: migration reverts clean
- **WHEN** the migration is reverted
- **THEN** `users` returns to its prior five columns and no FK to `files` remains

### Requirement: user response exposes avatarFileId [req-2]
The user response shape SHALL include `avatarFileId` (nullable) wherever a user is returned, and SHALL continue to omit `passwordHash`.

#### Scenario: me returns avatarFileId
- **WHEN** `GET /auth/me` succeeds for a user with no avatar
- **THEN** the body includes `avatarFileId: null` and contains no `passwordHash`

#### Scenario: avatar set is reflected
- **WHEN** a user has an avatar and `GET /auth/me` is called
- **THEN** `avatarFileId` is the uuid of their avatar file

### Requirement: update display name [req-3]
The API SHALL let the authenticated user change their display name via `PATCH /users/me`.

#### Scenario: valid name
- **WHEN** an authenticated user PATCHes `/users/me` with `{ "name": "New Name" }`
- **THEN** the response is their `UserDto` with `name` = "New Name" and the `users` row is updated

#### Scenario: empty name rejected
- **WHEN** the body is `{ "name": "" }`
- **THEN** the API returns 400 and the name is unchanged

#### Scenario: unauthenticated
- **WHEN** no session cookie is sent
- **THEN** `PATCH /users/me` returns 401

### Requirement: change password [req-4]
The API SHALL let the authenticated user rotate their password via `POST /users/me/password` after verifying the current password.

#### Scenario: correct current password
- **WHEN** an authenticated user posts `{ currentPassword: <correct>, newPassword: <≥8 chars> }`
- **THEN** the API returns 200 `{ success: true }` and the stored hash now verifies against the new password and no longer against the old

#### Scenario: wrong current password
- **WHEN** `currentPassword` does not match the stored hash
- **THEN** the API returns 401 with code `PROFILE_INVALID_CURRENT_PASSWORD` and the stored hash is unchanged

#### Scenario: new password too short
- **WHEN** `newPassword` is shorter than 8 characters
- **THEN** the API returns 400 and the password is unchanged

### Requirement: upload avatar [req-5]
The API SHALL let the authenticated user set their avatar via `PATCH /users/me/avatar` (multipart, field `file`), accepting only raster images up to 5 MB, storing the file through the existing file service and pointing `avatar_file_id` at it.

#### Scenario: valid image
- **WHEN** an authenticated user uploads a 1 MB PNG as `file`
- **THEN** the API stores the file, sets their `avatar_file_id`, and returns their `UserDto` with `avatarFileId` = the new file id

#### Scenario: oversize image
- **WHEN** the uploaded image exceeds 5 MB
- **THEN** the API returns a 4xx error (not 500) and `avatar_file_id` is unchanged

#### Scenario: disallowed type
- **WHEN** the uploaded file is an SVG or a non-image type
- **THEN** the API returns `FILE_UNSUPPORTED_TYPE` (4xx) and `avatar_file_id` is unchanged

### Requirement: avatar is viewable from the frontend origin [req-6]
The frontend SHALL serve the cookie-guarded file endpoint same-origin so an `<img>` can load an avatar without a cross-origin credential failure.

#### Scenario: same-origin avatar request
- **WHEN** the browser requests `/api/files/<id>` from the frontend origin with its session cookie
- **THEN** the request is proxied to the backend `GET /files/<id>` carrying the cookie and returns the image bytes

### Requirement: profile modal [req-7]
The nav-user dropdown SHALL open a single Profile modal with a photo-and-name section and a change-password section, built from existing UI components, and the trigger avatar SHALL show the user's uploaded image when present.

#### Scenario: open from dropdown
- **WHEN** the user clicks the nav-user "Profile" item
- **THEN** the Profile modal opens showing both sections (no "Soon" placeholder, no separate route)

#### Scenario: avatar persists on pick
- **WHEN** the user chooses a valid image in the photo section
- **THEN** a preview appears, the image uploads immediately, and the nav avatar updates without a modal save

#### Scenario: name save
- **WHEN** the user edits the name and clicks Save
- **THEN** the name updates and the nav-user label reflects it

#### Scenario: password mismatch blocks submit
- **WHEN** "new" and "confirm" differ, or "new" is under 8 chars
- **THEN** the Update-password button is disabled and an inline field error shows

#### Scenario: wrong current password inline
- **WHEN** the server rejects the current password (401)
- **THEN** an inline banner shows in the password section and no global error toast fires

#### Scenario: uploaded avatar renders in nav
- **WHEN** a user with an avatar loads the app
- **THEN** the nav-user trigger shows their image, falling back to initials if the image fails
