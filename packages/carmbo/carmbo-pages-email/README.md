# `@giltayar/carmbo-pages-email`

Email sending, delivery tracking, and email pages for Carmbo applications: a Resend email service,
a persistent `sendEmail` background job with retries and idempotency, a signed Resend delivery-callback
route, and read-only email list/detail pages.

The package is domain-agnostic. Domains (such as communities) render their own email content, queue it
with `queueEmail` in their own transaction, and react to the outcome through a per-purpose result
handler. This package never imports domain code.

## Usage

The host must initialize i18next, the app version, and the UI configuration, register
`@fastify/request-context` and the Zod validator/serializer compilers, and run the
`@giltayar/carmbo-commons@2.4.0` migrations (including the `email` schema).
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
app.register(emailRoutes, {prefix: '/emails', sql})
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
