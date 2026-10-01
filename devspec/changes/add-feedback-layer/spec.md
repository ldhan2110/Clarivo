# Spec: add-feedback-layer

### Requirement: theme tones [req-1]
The theme SHALL define a `--success` and a `--warning` token for both the light and dark palettes, and SHALL NOT introduce any other new token.

#### Scenario: light palette
- **WHEN** `app/globals.css` is read
- **THEN** `:root` declares `--success: oklch(0.58 0.14 157)` and `--warning: oklch(0.70 0.15 75)`
- **AND** `@theme inline` maps both to `--color-success` / `--color-warning` so `text-success` and `text-warning` resolve

#### Scenario: dark palette
- **WHEN** `.dark` is read
- **THEN** it declares `--success: oklch(0.72 0.16 157)` and `--warning: oklch(0.80 0.15 80)`

#### Scenario: no other token is added
- **WHEN** the change's diff on `globals.css` is reviewed
- **THEN** no `--info`, `--success-foreground` or `--warning-foreground` token appears
- **AND** the `info` tone resolves to the existing `--primary`, the `error` tone to the existing `--destructive`

### Requirement: toast presentation [req-2]
A toast SHALL render a flat tone icon, a title, and an optional description on the app's `--popover` surface, carrying its tone in the icon only.

#### Scenario: title and description
- **WHEN** `toast.success("Project created", { description: "Clarivo API v2 is ready." })` is called
- **THEN** a toast appears with the title in 13.5px/600 `--popover-foreground` and the description in 12.5px `--muted-foreground` below it

#### Scenario: title only
- **WHEN** `toast.info("Analysis still running")` is called with no description
- **THEN** the toast renders the icon and title alone, with no empty description row

#### Scenario: the four tones
- **WHEN** each of `toast.success`, `toast.info`, `toast.warning`, `toast.error` is called
- **THEN** the icon colour is `--success`, `--primary`, `--warning`, `--destructive` respectively
- **AND** the icon is a solid tone-filled shape with its glyph knocked out in `--popover`

#### Scenario: tone never touches the surface
- **WHEN** any toast is rendered
- **THEN** its background is `--popover`, its border is 1px `--border`, and neither varies by tone
- **AND** no tone-coloured rail, edge or tint appears anywhere on the toast

### Requirement: toast placement and lifetime [req-3]
Toasts SHALL stack from the top-right on desktop and full-width below the top bar on mobile, auto-dismiss after 4 seconds, and never exceed three on screen.

#### Scenario: desktop placement
- **WHEN** a toast appears on a viewport ≥768px wide
- **THEN** it sits 16px from the top and 16px from the right edge, 364px wide

#### Scenario: mobile placement clears the top bar
- **WHEN** a toast appears on a 390px-wide viewport
- **THEN** its top edge is 66px from the top of the viewport — below the 58px app bar — and it spans the full width inside 16px gutters
- **AND** it covers neither the hamburger nor the bell

#### Scenario: auto-dismiss
- **WHEN** 4 seconds pass without interaction
- **THEN** the toast leaves on its own

#### Scenario: manual dismiss
- **WHEN** the close affordance is clicked
- **THEN** that toast leaves immediately and the others close the gap

#### Scenario: stack cap
- **WHEN** a fourth toast is raised while three are on screen
- **THEN** at most three are mounted at any time

### Requirement: global mutation error reporting [req-4]
A failed mutation SHALL raise an error toast automatically, unless that mutation defines its own `onError`.

#### Scenario: unhandled mutation failure
- **WHEN** a mutation with no `onError` of its own rejects
- **THEN** exactly one error toast appears, carrying `apiErrorMessage(error)`

#### Scenario: the call site takes over
- **WHEN** a mutation that defines its own `onError` rejects
- **THEN** no global toast appears and only the mutation's own handler runs

#### Scenario: queries are not toasted
- **WHEN** a `useQuery` fetch fails
- **THEN** no toast appears

#### Scenario: success is never global
- **WHEN** any mutation succeeds
- **THEN** no toast appears unless that mutation's own `onSuccess` raises one

#### Scenario: existing query behaviour is preserved
- **WHEN** the `QueryClient` is constructed
- **THEN** `defaultOptions.queries` still carries `staleTime: 60_000` and `refetchOnWindowFocus: false`

### Requirement: API error messages [req-5]
`apiErrorMessage` SHALL turn a thrown request error into user-facing copy without ever surfacing a server-internal message.

#### Scenario: 4xx with an envelope
- **WHEN** the error is an Axios error whose response body is `{statusCode: 400, code: "PROJECT_NAME_TAKEN", message: "A project with that name exists"}`
- **THEN** the returned string is that `message`

#### Scenario: 5xx
- **WHEN** the error is an Axios error with status 500
- **THEN** the returned string is the generic `"Something went wrong. Please try again."` and never the response body's message

#### Scenario: not an Axios error
- **WHEN** the error is an arbitrary thrown value
- **THEN** the returned string is the generic message and never `error.message`

### Requirement: confirm resolution contract [req-6]
`confirm(options)` SHALL return a promise resolving `true` on confirm and `false` on cancel, and SHALL fire `onConfirm` / `onCancel` when supplied.

#### Scenario: confirmed
- **WHEN** the user clicks the confirm button
- **THEN** `onConfirm` runs, the dialog closes, and the promise resolves `true`

#### Scenario: cancelled by button
- **WHEN** the user clicks the cancel button
- **THEN** `onCancel` runs, the dialog closes, and the promise resolves `false`

#### Scenario: cancelled by Escape or overlay
- **WHEN** the user presses `Esc`, or clicks the overlay, while not pending
- **THEN** the outcome is identical to clicking cancel

#### Scenario: promise-only call site
- **WHEN** `confirm()` is called with neither callback
- **THEN** the dialog still works and the promise alone reports the outcome

#### Scenario: a second confirm while one is open
- **WHEN** `confirm()` is called while a dialog is already open
- **THEN** the new options replace the open dialog, the first promise resolves `false`, and the first `onCancel` does not fire

### Requirement: confirm pending state [req-7]
While an async `onConfirm` is in flight the dialog SHALL stay open, disable both buttons, and refuse to be dismissed.

#### Scenario: spinner while working
- **WHEN** `onConfirm` returns a promise that has not settled
- **THEN** the dialog is still open, the confirm button shows a spinner, and its label is unchanged

#### Scenario: no double submit
- **WHEN** the confirm button is clicked twice in a row
- **THEN** `onConfirm` runs exactly once

#### Scenario: dismissal is blocked while pending
- **WHEN** `Esc` is pressed or the overlay is clicked while pending
- **THEN** the dialog stays open and nothing is cancelled

#### Scenario: failure is never silent
- **WHEN** `onConfirm` rejects
- **THEN** the dialog closes, the promise resolves `false`, and an error toast appears
- **AND** when the rejection came from a mutation that was already toasted globally, the confirm toast reuses a fixed id so the two do not stack

#### Scenario: sync confirm does not flash a spinner
- **WHEN** `onConfirm` is synchronous or absent
- **THEN** the dialog closes immediately with no pending state

### Requirement: confirm presentation [req-8]
A confirm dialog SHALL render a flat tone icon, title, optional description and right-aligned Cancel/Confirm buttons, with `tone` affecting only the icon and the confirm button's variant.

#### Scenario: default tone
- **WHEN** `confirm({ title: "Publish 14 requirements?" })` is called with no `tone`
- **THEN** the tone is `confirm`: a `--primary` question icon and a `variant="default"` confirm button

#### Scenario: error tone drives the destructive button
- **WHEN** `tone: "error"` is passed
- **THEN** the icon is `--destructive` and the confirm button is `variant="destructive"`

#### Scenario: the other tones do not change the button
- **WHEN** `tone` is `success`, `info` or `warning`
- **THEN** the icon colour follows the tone and the confirm button stays `variant="default"`

#### Scenario: optional description
- **WHEN** `description` is omitted
- **THEN** the title sits alone beside the icon with no empty row

#### Scenario: custom labels
- **WHEN** `confirmLabel` and `cancelLabel` are passed
- **THEN** the buttons use them; otherwise they read "Confirm" and "Cancel"

#### Scenario: buttons are the project's Button
- **WHEN** the dialog is rendered
- **THEN** both buttons are `components/ui/button.tsx:Button`, not hand-rolled elements

#### Scenario: focus
- **WHEN** the dialog opens
- **THEN** focus is on the confirm button and is trapped inside the dialog until it closes

### Requirement: delete confirmation preset [req-9]
A `confirmDelete` preset SHALL supply the standard copy and tone for a deletion, so no screen writes its own.

#### Scenario: with a name
- **WHEN** `confirmDelete("project", "Clarivo API v2")` is spread into `confirm()`
- **THEN** the title reads `Delete project?`, the description names `"Clarivo API v2"` and says it cannot be undone, the confirm label is `Delete`, and the tone is `error`

#### Scenario: without a name
- **WHEN** `confirmDelete("meeting")` is used
- **THEN** the description omits the name but still says the action cannot be undone

### Requirement: sign-out is confirmed [req-10]
Signing out SHALL ask for confirmation first and report success with a toast.

#### Scenario: confirmed sign-out
- **WHEN** `Sign out` is chosen in the user menu and the dialog is confirmed
- **THEN** the logout mutation runs, the auth store is cleared, the browser lands on `/login`, and a success toast appears

#### Scenario: cancelled sign-out
- **WHEN** the dialog is cancelled
- **THEN** no logout request is made and the user stays where they were

### Requirement: no double-reported auth errors [req-11]
The login and logout flows SHALL NOT raise a global error toast on top of their existing handling.

#### Scenario: bad login credentials
- **WHEN** login fails with a 401
- **THEN** the message appears once, inline in the form, and no toast appears
- **AND** the message stays the generic `"Incorrect email or password."`, revealing nothing about whether the email exists

#### Scenario: logout request fails
- **WHEN** the logout request fails
- **THEN** no error toast appears and the user is still cleared and redirected to `/login`

### Requirement: reviewable demo surface [req-12]
The dashboard SHALL carry a temporary demo card that raises every tone and opens a confirm dialog, marked for deletion.

#### Scenario: all four tones from one place
- **WHEN** each demo button is clicked
- **THEN** a success, info, warning and error toast can each be raised, with title and description

#### Scenario: confirm from the demo card
- **WHEN** the demo's confirm button is clicked
- **THEN** a destructive confirm dialog opens, and confirming it raises a success toast after a short artificial delay that exercises the pending state

#### Scenario: marked as temporary
- **WHEN** the demo card's source is read
- **THEN** a `// ponytail:` comment marks it as a demo to delete when real screens land

### Requirement: dark theme parity [req-13]
Every surface this change adds SHALL follow the `.dark` class without a per-component override.

#### Scenario: toast in dark
- **WHEN** `class="dark"` is set on `<html>` and a toast of each tone is raised
- **THEN** each uses the `.dark` values of `--popover`, `--border`, `--muted-foreground` and its tone token

#### Scenario: dialog in dark
- **WHEN** `class="dark"` is set and a confirm dialog opens
- **THEN** the dialog uses `.dark` `--popover` and the destructive confirm button renders at the `dark:bg-destructive/60` weight from `button.tsx`

#### Scenario: no OS-preference styling
- **WHEN** the Toaster's props are read
- **THEN** no `theme` prop and no `richColors` prop is set, and nothing in the change reads `prefers-color-scheme`
