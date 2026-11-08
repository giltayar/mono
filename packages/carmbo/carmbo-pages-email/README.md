# `@giltayar/carmbo-pages-email`

Email sending, delivery tracking, and email pages for Carmbo applications: a Resend email service,
a persistent `sendEmail` background job with retries and idempotency, a signed Resend delivery-callback
route, read-only sent-email list/detail pages, and editable email templates with history and preview
sending.

The package is domain-agnostic. Domains (such as communities) render their own email content, queue it
with `queueEmail` in their own transaction, and react to the outcome through a per-purpose result
handler. This package never imports domain code.

## Source structure

- `src/emails/` owns sent-email routes, controllers, models, views, locales, sending services, jobs,
  and delivery webhooks.
- `src/templates/` owns template routes, editing, history, preview sending, and editor assets.
  Its pages are server-rendered htmx (`view/`); React is limited to the HTML editor island
  (`client/`). `editor-extensions.ts` is shared by that island and the server-side HTML export.
- `src/layout/` owns the shared Emails/Templates tabs and their locale strings.
- `src/route.ts` mounts both page subsystems. Public package entry points and URLs stay unchanged.

## Usage

The host must initialize i18next, the app version, and the UI configuration, register
`@fastify/request-context`, `@fastify/formbody` with a `qs` parser (template pages post nested
`previewValues[name]` form fields), and the Zod validator/serializer compilers, and run the
`@giltayar/carmbo-commons@2.4.1` migrations (including the `email` and `email_template` schemas).
Initialize the published jobs `1.0.5` executor and register the email handler before mounting routes:

```ts
import {routes as emailRoutes} from '@giltayar/carmbo-pages-email/routes'
import {webhookRoutes} from '@giltayar/carmbo-pages-email/webhook-routes'
import {registerSendEmailJobHandler} from '@giltayar/carmbo-pages-email/jobs'
import {createResendEmailService} from '@giltayar/carmbo-pages-email/service'
import {initializeJobExecutor, triggerJobsExecution} from '@giltayar/carmbo-pages-job/jobs/executor'

const nowService = () => new Date()
initializeJobExecutor(sql, app.log)
// Registers a Resend webhook for `webhookUrl`; dispose() deletes it on shutdown.
const emailService = await createResendEmailService({
  apiKey,
  webhookUrl: 'https://your-host.example/api/emails/resend/webhook',
})
const queueEmail = registerSendEmailJobHandler({
  sql,
  nowService,
  emailService,
  resultHandlers: {'registration-email': handleRegistrationEmailResult},
})
app.register(emailRoutes, {
  prefix: '/emails',
  sql,
  nowService,
  emailService,
  from: 'Carmbo <sender@your-verified-domain.example>',
})
// Outside the browser-authentication boundary: Resend calls it, authenticated by its signature.
app.register(webhookRoutes, {
  prefix: '/api/emails/resend',
  sql,
  signingSecret: emailService.webhookSigningSecret,
})
app.addHook('onListen', () => void triggerJobsExecution(nowService))
app.addHook('onClose', () => emailService.dispose())
```

Call `setUiConfiguration(name, {withCommunities: true})` to show the Emails navigation item. Mount
the email pages inside the host's authentication boundary; this package does not configure
authentication itself.

**Registration API change:** email routes now require `nowService`, `emailService`, and `from` in
addition to `sql`, so template preview sending can reuse the host's configured provider. Route
registration fails if these services are missing. This package does not construct an SDK client in
its controllers or change existing queued-email purposes or payloads.

### Email templates

The Emails/Templates tabs lead to `/emails/templates`, with name/description search, 50-row infinite
scrolling, and an Include archived filter. `/emails/templates/new` creates a template;
`/emails/templates/:number` edits it. Templates have a name, description, subject template,
independently editable plain-text template, HTML template, and Hebrew/English content language.
The list follows the student/community list layout: inline title/search/archive controls, numbered
row buttons, and the shared floating plus-circle action. Archived rows are marked beside the name.
Template detail pages use the same bordered headings, top action groups, floating-label form cards,
and history lists as student/community pages. Metadata is half-width on desktop and full-width on
mobile; the HTML editor keeps the full available width for its editing controls.

Create/update append immutable data/history snapshots. Archive and restore append history entries
without changing the content. Archived templates and `/emails/templates/:number/by-history/:historyId`
are read-only. Restore re-enables editing. Template names need not be unique.

The browser-only React Email editor supports rich text, headings, lists, tables, columns,
links/buttons, themes/style inspectors, and images by HTTP(S) URL. Image-file paste/drop/upload is
disabled; no upload endpoint or storage service is provided. Its Radix toolbar uses grouped icon
buttons with active formatting states, keyboard navigation, text-style/insert menus, and popovers
for links, images, and Handlebars expressions. To edit a link's URL, click its text (or a linked
button) and open Link in the toolbar: it loads the selected link's current URL. Apply link updates
the whole link; opening Link on unlinked text starts with an empty URL. Image URLs are separate.
The toolbar and custom style inspector support English and Hebrew. The inspector sits beside the
editor on desktop and below it on smaller screens. Selecting text enables span mode (text color,
font size, background); placing the caret in a paragraph enables paragraph mode, adding solid
border color/width/radius and left/right padding and margin. Clicking outside a paragraph selects
container mode: left/right/top padding and margin, background, and the same border controls.
Colors use native color pickers; numeric controls use pixels and native increment/decrement arrows.
All three modes group their controls into clearly titled, bordered Text, Padding, Margin, Border,
and Background sections, showing only the sections relevant to the current mode.
Field labels are concise within their section (Left, Right, Color, etc.); accessible names retain
the full property context.
Span changes preserve existing formatting and affect only selected text. Paragraph styles live on
the paragraph; container styles are saved on the editor's content container and exported on an
inner content div, never on the email body or outer layout table. Existing layout/theme defaults
remain intact. The theme selector remains available, and read-only revisions hide the inspector.
Content language sets the email's language/direction independently of the application's UI
language; individual text blocks can switch between RTL and LTR. Saved editor JSON and its format
version preserve the editable document; exported HTML is saved alongside it for email use.
Exported content carries its own direction and start alignment, independent of the renderer's
LTR body defaults or an email client's surrounding layout. Explicit block directions and alignments
remain intact in both preview and sent HTML.

Subject, plain text, HTML text, and URL fields accept Handlebars. Built-in conditionals, loops,
nested paths, and triple-brace raw HTML are supported, but custom helpers and external partials are
not. Missing values use normal Handlebars empty/false behavior. Normal HTML substitutions are
escaped; plain text and subjects are not HTML-escaped. Use the expression insertion control to add
standalone opening/else/closing block statements around structured content, rather than wrapping
them inside ordinary paragraphs. Saving validates a template by rendering it without values, so
syntax errors are caught, but errors inside branches that need data (for example an unknown helper
inside `{{#if}}`) only surface when such a template is rendered with data. Rendered HTML, including
triple-brace values, is not filtered: templates are written by trusted users, and email clients
apply their own HTML sanitization. Provider subjects cannot contain newlines.

Sample fields deliberately use regex discovery for simple `{{name}}` expressions only. Dotted paths,
helper/block expressions, triple braces, and unusual names are ignored. Every value is a string;
there is no nested-object or array input. To supply a value used only in a complex expression,
reference its simple name elsewhere in the template. The server re-renders the sample fields as the
subject, plain text, or editor content change. Non-empty sample values are saved with each revision,
including values whose expressions were later removed; emptied values are dropped. They are sample
data, not a domain-variable catalog; use non-sensitive examples.

View raw HTML opens a read-only, selectable source dialog for the current unsaved HTML template,
with Handlebars expressions intact (not replaced by sample values). It does not save or send.
Archived and historical templates expose their stored HTML through the same action.

Preview opens a modal showing the current unsaved subject, HTML, and an expandable plain-text body.
Its sandboxed iframe blocks remote resources and uses an email-sized viewport rather than centering
the email across the entire page. The email HTML and its own layout styles are not changed.
Remote image URLs remain in sent email. Send preview email opens a separate modal with a recipient
field and Send/Cancel controls. Send submits the current subject, both bodies, and sample substitutions
using the configured sender. The recipient is remembered in a `carmbo-template-preview-recipient`
cookie (path `/emails/templates`) across templates and browser restarts, and pre-filled by the
server; clearing the field removes it. It is not stored with the template or sent automatically.
Cancel or Escape dismisses the dialog without sending.
While a send is in progress, dismissal is disabled. Failures stay in the dialog for retry; success closes it and
shows the provider-acceptance message on the page. It calls the provider
directly: **no email/job rows, template revision, queue, retry job, or delivery tracking are created**.
Success means provider acceptance, not delivery confirmation. Errors preserve page edits; retrying
the same failed attempt reuses its idempotency key, which the server derives from the dialog's
request ID plus a hash of the recipient and rendered content. Each newly opened dialog is a new send.

The template page is an htmx form, like the student pages. Save, archive, and restore redirect on
success; failures re-render the form (or page) with an error banner, keeping every edit. Preview,
raw HTML, and send-preview dialogs are server-rendered fragments. Requests that need the editor
content read it synchronously through `hx-vals="js:{editorDocument: templateEditorDocument()}"`,
a bridge exposed by the editor island. The browser never sends HTML: the server exports the email
HTML from the submitted editor JSON with a headless TipTap editor and `composeReactEmail`, both on
save and for preview/raw HTML/send. Template writes and preview endpoints are private under the same
host authentication boundary as the email pages.
Requests are limited to 4 MiB; bodies are limited to one million characters each, sample values to
10,000 characters, and editor nesting to 40 levels. Unsupported document versions/nodes are rejected.

### Browser build

`pnpm build` runs TypeScript and esbuild in parallel after one clean. `build:client`
(`scripts/build-client.ts`) bundles the React editor island (editor, toolbar, and style inspector)
and CSS into `dist/browser/email-template`. Because email HTML is exported on the server, the
browser bundle replaces `@react-email/editor`'s code-block email renderer (with react-email's bundled
Prism grammars and themes) and `hast-util-from-html` (with parse5) with small shims in
`src/templates/client/shims/`, roughly halving `editor.js`. The build fails if a dependency update
stops these replacements from matching. Only template edit/history pages load these
assets, from versioned `/emails/templates/assets/<package-version>/editor.js` and `editor.css` routes.
Their URLs also include a content hash, so rebuilding without a package version bump invalidates
previous browser caches. Hashes are computed once when the server loads the template view module.
Asset responses require revalidation rather than immutable caching.
The package serves only these allowlisted assets; the host does not need to copy them.

`pnpm start` builds client assets in its prestart lifecycle. When changing browser code during local
development, run `pnpm build:client`, restart the server to refresh the asset URLs, and reload the page.
Server runtime modules do not import TSX. Both published and source-run routes use the built assets.

The standalone app includes template management and uses its existing sender/service configuration.
`carmbo-app` integration and adoption by community registration emails remain separate work.

### Queueing emails

`registerSendEmailJobHandler` registers the `sendEmail` job handler, once per application process,
and returns `queueEmail`. Call it inside the caller's own transaction:

```ts
await sql.begin(async (tx) => {
  // ... the caller's own writes ...
  const {emailNumber, jobId} = await queueEmail(
    {
      purpose: 'registration-email',
      from: 'Carmbo <sender@your-verified-domain.example>',
      to: 'student@example.com',
      subject: 'Welcome',
      html: '<!doctype html><p>Welcome</p>',
      text: 'Welcome',
      language: 'en',
      // Opaque JSON, stored as the job payload and passed back to the result handler.
      payload: {communityNumber: 1, studentNumber: 2},
    },
    now,
    tx,
  )
})
await triggerJobsExecution(nowService)
```

`queueEmail` saves the complete email and submits its job in that transaction, so a rollback leaves
neither. No provider request runs inside it: trigger job execution after commit. The saved subject,
HTML, text, and language are sent unchanged on every attempt.

`purpose` is an `EmailPurpose` (currently only `'registration-email'`), mirroring the
`email.purpose` database constraint. A new purpose needs a `carmbo-commons` migration first.

### Result handlers

`resultHandlers` maps a purpose to an `EmailResultHandler`, which receives
`{emailNumber, payload, result, now, tx}`, where `result` is `{sentAt}` or `{errorText}`. The job
looks up the handler by the purpose saved on the email. It is called in the same transaction that
records the email's outcome:

- after provider acceptance (by the API response or an earlier delivery callback), with `{sentAt}`;
- after the fourth failed attempt, with the last provider error as `{errorText}`.

If the handler throws, the transaction rolls back and the job retries. The retry reuses the same
idempotency key, so Resend does not send the email again. Purposes without a handler are still sent
and tracked. Delivery callbacks only update the email record and never call result handlers.

### Sending, retries, and idempotency

Every send attempt appends its start timestamp; retries also append their actual retry-start
timestamp. API acceptance records the provider ID and acceptance timestamp. A failed attempt sets the
email to `retrying`; the fourth failed attempt sets it to `failure` with the provider error text.

Retries reuse `<purpose>/<uuid>` as the idempotency key, where the UUID is the email's immutable
`carmbo_email_id` tag. Local job IDs restart in every database sharing a Resend account, so they would
collide across environments. Known local acceptance is never resent. Resend retains keys for 24
hours, so an unknown acceptance retried after that window can send a duplicate. Retry execution uses
existing job triggers, not a new scheduler or backoff policy.

### Delivery callbacks

`webhookRoutes` exposes `POST <prefix>/webhook`. Signed Resend callbacks update only the email record:

- `email.delivered` sets `success` with the event time as the delivery-confirmed time.
- `email.bounced`, `email.failed`, and `email.suppressed` set `failure` with the provider's reason.
- Callbacks are matched by provider email ID, or by the `carmbo_email_id` tag when they arrive before
  the API response was saved (for example, a lost response). A known provider ID proves acceptance,
  so the job then records acceptance without calling Resend again, even if its own attempt failed.
- Each event applies only if it is newer than the last applied provider event, so duplicate and
  out-of-order callbacks are acknowledged as `stale` without regressing the status. API acceptance
  never overrides a callback's `success` or `failure`.
- Missing, invalid, or tampered signatures and malformed payloads return 400. Events for unknown
  emails (one Resend webhook receives the whole account's events) and unsupported event types are
  acknowledged with 200 and logged. Processing failures return 500, so Resend retries.

`createResendEmailService` is async: during initialization it registers a Resend webhook for the
required public HTTPS `webhookUrl`, subscribed to `email.delivered`, `email.bounced`, `email.failed`,
and `email.suppressed` (`HANDLED_RESEND_EVENTS`), and exposes that webhook's `webhookSigningSecret`.
Registration failures (for example, a sending-only API key) reject initialization; a missing signing
secret fails route registration. Whoever creates the service owns `dispose()`, which deletes the
webhook (repeated calls do nothing). Before registering, initialization deletes any webhook already
registered for exactly the same URL: with one server per URL, that is a leftover from a process
killed without disposing. Webhooks for any other URL (other environments, dev tunnels) are never
touched.

### Email pages

- `/emails` lists all emails by creation time descending, then email number descending. Search
  matches recipient address, current community name, or current student name; SQL wildcard
  characters are literal. Paging uses 50-row HTMX infinite scrolling.
- Each row links to `/emails/:number`, showing purpose, recipient, optional community/member links,
  creation/acceptance/delivery times, all retry/send timestamps, status, and diagnostic text.
  Detail also shows the saved sender, subject, language, job/provider IDs, tags, HTML and plain text.
- HTML previews use a sandboxed iframe with scripts disabled and a content security policy blocking
  remote resources, including tracking images. `/emails/:number/html` serves the original source as
  plain text with `nosniff`, never executable application-origin HTML.
- `delivered` means API acceptance and `success` means provider-confirmed delivery. The UI labels
  make that distinction explicit. Both English and Hebrew/RTL are supported.
- The community/member columns are resolved through `community_member.registration_email_number` by
  SQL, without importing community code. Unlinked emails remain fully viewable.

### Email service and fake

```ts
import {createResendEmailService} from '@giltayar/carmbo-pages-email/service'
import {createFakeEmailService} from '@giltayar/carmbo-pages-email/testkit/email-service'

const service = await createResendEmailService({apiKey, webhookUrl})
const fake = createFakeEmailService()

const result = await service.sendEmail(message, {idempotencyKey: 'sendEmail/42'})
```

Messages and send options use plain TypeScript types, with no runtime request validation or
normalization in either the real service or the fake. The service uses the Resend SDK, preserves the
idempotency key and tags, and returns `{id}` on API acceptance. It performs no automatic retries or
database writes. Provider errors throw `EmailSendingError` with `code`, `statusCode` (nullable for
transport errors), and the provider's message. `apiUrl` can override the endpoint for local adapter
tests.

The fake has the same `sendEmail` interface, observable `attempts` and `sentEmails` snapshots, and
`failNextSend(error, {afterAcceptance: true})` for simulating a lost response after acceptance.
Without that option, the failure happens before acceptance. Inject `nowService` to test expiry.
Reusing a key with identical content returns the original ID for 24 hours; changed content rejects.

Public types are `EmailService`, `ResendEmailService`, `EmailMessage`, `EmailSendOptions`, and
`EmailSendResult` (from `./service`); `QueueEmail`, `EmailToQueue`, `EmailPurpose`,
`EmailJobPayload`, `EmailResult`, `EmailResultHandler`, and `EmailResultHandlers` (from `./jobs`);
and `FakeEmailService` (from `./testkit/email-service`). Email page models are exported from
`@giltayar/carmbo-pages-email/testkit/page-model/email.model`.

## Local start

```bash
pnpm start
```

`pnpm start` loads the gitignored `.env.local` (see `.env.example`). Set `RESEND_API_KEY` and
`RESEND_FROM`; `RESEND_TEST_API_KEY` and `RESEND_TEST_FROM` are accepted as fallbacks. Missing
configuration fails at startup; no fake is substituted.

Open <http://127.0.0.1:3000/emails>. The start-only page <http://127.0.0.1:3000/dev/test-email>
sends a real email through Resend; use `delivered@resend.dev` or `bounced@resend.dev` to simulate
outcomes. Test emails use the `registration-email` purpose (the only one the schema allows) and have
no result handler.

To receive delivery callbacks locally, startup opens a
[cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/)
quick tunnel (`brew install cloudflared`; no account needed) and registers a temporary Resend
webhook, so the API key needs full access. Ctrl+C closes the app, deletes the webhook, and stops the
tunnel. If the process is killed without cleanup, delete the stale `*.trycloudflare.com` webhook in
the Resend dashboard.

The host also mounts `/jobs` and `POST /api/jobs/trigger-job-execution?secret=...` (set
`JOB_API_SECRET` to protect it). Use `LANGUAGE=he pnpm start` for Hebrew/Liraz rendering. The
Fastify and PostgreSQL ports are fixed at `3000` and `5436`. Stop and remove PostgreSQL with:

```bash
pnpm stop
```

## Verification

Run `pnpm build` before `pnpm test`. Docker, an installed Playwright Chromium browser, and (for
`test:e2e`) the `.env.local` Resend configuration and `cloudflared` are required.

- Unit tests cover the Resend adapter and fake, stored-model mapping, and the published exports.
- Integration tests (`pnpm test:playwright`) cover the list (`emails.test.ts`) and detail
  (`email.test.ts`) pages, Hebrew pages, sending (`sending.test.ts`: atomic queueing and rollback,
  retries, exhaustion, lost responses, result-handler failures, concurrent triggers, standalone
  restart), and signed callbacks (`webhook.test.ts`). They seed community/student rows by SQL only
  to exercise the member links.
- `pnpm test:e2e` sends a real email through the standalone app's test-email form to
  `delivered+<run-id>@resend.dev` and waits for the real, signed delivery callback through the tunnel.

Only the user publishes. Publish this package before updating any consumer to its exact published
version; there is no workspace linking.
