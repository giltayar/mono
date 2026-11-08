# `@giltayar/carmbo-pages-community`

Community pages for Carmbo applications: a searchable, paged community list and pages to create,
update, archive, restore, and view the history of a community.
Each community also has a separate Members tab/page with a paged membership list, a student picker/create flow, and dedicated
membership role/lifecycle/history pages.

## Usage

The host must initialize i18next, the app version, and the UI configuration, register
`@fastify/formbody`, `@fastify/request-context`, the Zod validator/serializer compilers, and run
the `@giltayar/carmbo-commons@2.4.0` migrations (including membership and email schemas).
Initialize the published jobs `1.0.5` executor and register the email handler before mounting routes:

```ts
import {routes as communityRoutes} from '@giltayar/carmbo-pages-community/routes'
import {routes as emailRoutes} from '@giltayar/carmbo-pages-community/email/routes'
import {registerSendEmailJobHandler} from '@giltayar/carmbo-pages-community/email/jobs'
import {createResendEmailService} from '@giltayar/carmbo-pages-community/email/service'
import {initializeJobExecutor, triggerJobsExecution} from '@giltayar/carmbo-pages-job/jobs/executor'

const nowService = () => new Date()
initializeJobExecutor(sql, app.log)
// Registers a Resend webhook for `webhookUrl`; dispose() deletes it on shutdown.
const emailService = await createResendEmailService({
  apiKey,
  webhookUrl: 'https://your-host.example/api/emails/resend/webhook',
})
const submitSendEmailJob = registerSendEmailJobHandler({sql, nowService, emailService})
app.register(communityRoutes, {
  prefix: '/communities',
  sql,
  nowService,
  // `language` is the configured app language: 'en' or 'he'.
  registrationEmail: {submitSendEmailJob, from, language: 'en'},
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

`webhookRoutes` comes from `@giltayar/carmbo-pages-community/email/webhook-routes` and exposes
`POST <prefix>/webhook`. `createResendEmailService` is async: during initialization it registers a
Resend webhook for the required public HTTPS `webhookUrl`, subscribed to `email.delivered`,
`email.bounced`, `email.failed`, and `email.suppressed` (`HANDLED_RESEND_EVENTS`), and exposes that
webhook's `webhookSigningSecret`. Registration failures (for example, a sending-only API key) reject
initialization; a missing signing secret fails route registration. Whoever creates the service owns
`dispose()`, which deletes the webhook (repeated calls do nothing). A process killed without
disposing leaves a stale webhook in the Resend dashboard.

`registrationEmail` is required, including a non-empty `from`; missing sending configuration must not
silently skip email creation. Email creation (the saved email row, its member link, and its job
submitted in the same transaction) lives in the email model; `registerSendEmailJobHandler` only
registers the `sendEmail` handler, once per application process, and returns its job submitter.
After adding a member, the routes call `triggerJobsExecution`; hosts trigger it after startup to
resume persisted jobs, and reuse their existing job-execution triggers for retries.
The executor and all page packages must share one published jobs/commons runtime instance.

Optionally pass `smooveIntegration` and `ravmesserIntegration` to use the host's configured student
contact integrations when creating students. These options are backwards-compatible and do not send
community registration emails. Mount the published student routes at `/students` to support the
student-profile links; the standalone host already does this.
This package uses student pages `1.1.1`, sharing the installed commons `2.4.0`. Hosts mounting both page
packages must use the same commons runtime instance for version, UI configuration, and test hooks.
When mounting the student routes, parse nested URL-encoded form fields (for example with
`qs.parse`); the standalone host and integration fixtures do this.

Call `setUiConfiguration(name, {withCommunities: true})` to show the Communities and Emails navigation
items. There is no separate email flag. Mount both sets of routes inside the host's authentication
boundary; this package does not configure authentication itself.
Page models for browser tests are exported from `@giltayar/carmbo-pages-community/testkit/page-model/*`.
`createCommunityMembersPageModel` covers the list and tabs; `createNewCommunityMemberPageModel`
in `new-community-member-page.model` covers the add form and its student dialog.
List rendering lives in [members.ts](./src/view/members.ts); individual member pages and dialogs
live in [member.ts](./src/view/member.ts), with shared translations in
[member-text.ts](./src/view/member-text.ts).

## Memberships

- Community Details and Members are separate tabs and server-rendered pages. Details remains at
  `/communities/:number`; the membership list is at `/communities/:number/members`.
  The Members tab follows the other list pages: live search (`q`), 50-row infinite scrolling
  (`page`), ID buttons, and the floating add action. Search is scoped to the current community and
  retained during paging. All memberships, including inactive ones, are shown newest entry first.
  Equal entry times are ordered by entry-order value, not by student number or latest edit time.
- The add page uses the same summary and role cards as the membership detail page. Its editable
  student field has a **Search / create student** button, opening a dialog with live search and an
  expandable create form (first name, last name, email, optional phone), like the sale form.
  Selecting or creating a student fills the summary and closes the dialog without leaving the
  page or resetting the roles. A single **Add member** submission creates the membership with
  those roles and its first history snapshot. Creation reuses the published student API and its
  normalization, uniqueness validation, and history. Student creation happens in the dialog,
  independently of membership creation; a failed add keeps the selection and roles for retry
  without creating another student. Cancelling the dialog leaves the add form unchanged.
- New members default to viewer and poster; viewer is implicit and poster can be removed.
  Existing memberships and roles preserved on re-add are unchanged.
  Poster, live streamer, moderator, user blocker, and user approver are five
  independent roles scoped to each membership. These are stored capabilities; enforcement in a
  community-facing application is not part of this package.
- Open `/communities/:number/members/:studentNumber` from the member list to manage a membership.
  The ID button opens the membership; the member's name links to their student profile.
  The responsive detail page groups the summary, roles, and membership actions into cards, hides
  empty registration metadata, and shows readable dates with time tooltips.
  Breadcrumbs link back to Communities and the community's member list; the student profile link
  appears in the membership summary.
  Membership sections, forms, navigation, and tables have accessible names; their page models use
  roles and labels rather than CSS classes.
  Available actions depend on its status: approve/reject requests, mark registered, cancel a
  registration, unregister voluntarily or by backoffice removal, block, re-add, or unblock-and-re-add.
  Rejected requests become `unregistered` with reason `rejected`.
- Adding opens the new member's detail page. Re-add/unblock-and-re-add stay on that member's
  detail page. Membership and add pages
  link back to that list, not to the community Details page.
- One membership exists per community/student pair. Adding an existing membership is an explicit
  error; use its re-add action instead. Re-add/unblock preserves its identity and roles, starts a new
  registration directly in `registered` status without sending another email, refreshes the entry
  date/order, and clears the previous attempt's diagnostics and
  email-sent timestamp. Ordinary role/status edits do not change entry order.
- Every change atomically appends immutable history/data snapshots and moves `last_history_id`.
  Current data is resolved through history, never a denormalized current-data pointer. Mutations
  serialize on the community row and check the submitted expected history ID to reject stale edits.
- Membership history has its own read-only snapshot pages at
  `/communities/:number/members/:studentNumber/by-history/:operationId`. History entries match the
  student history styling: only the date is displayed, with the time in a tooltip. This history is separate
  from community-details history. Membership snapshots retain membership fields, not copies of
  student profiles; student links/names show the current student record.
- Archived communities show memberships/history read-only and reject membership mutations.
  Archived students cannot be added or re-added. Blocked memberships require explicit unblock-and-
  re-add and do not allow role edits while blocked.

Supported statuses are `requested-registration`, `started-registration`, `registration-email-sent`,
`registration-failed`, `registered`, `cancelled`, and `unregistered`. Failure reasons are
`email-sending-failed`/`timeout`; unregistration reasons are `self`/`removed`/`blocked`/`rejected`,
with optional diagnostic text. The model validates status/reason/email-timestamp combinations.

**Deferred:** member-page status polling/email links, automatic timeout processing,
public/self-service registration endpoints, community permission enforcement, and carmbo-app integration.
The planned
timeout is seven days after sending the registration email, not after adding a student.

## Emails

Email code lives under `src/email`, separate from the community route/controller/view/model.
The email pages are read-only. Adding a member now atomically creates the membership, initial
history snapshot, saved registration email, reverse member link, and `sendEmail` job.
Only after commit does the controller trigger background execution; no provider request runs inside
the creation transaction. A failed creation leaves none of those partial records.

The simple English/Hebrew registration email contains the student and community names, HTML and
plain text, but no registration link yet. Its complete payload and language are saved before sending;
student/community edits and retries do not change what is sent. Approval does not send another email.
Re-add and unblock-and-re-add go directly to `registered` and retain the original stable email link.

Every send attempt appends its start timestamp; retries also append their actual retry-start timestamp.
API acceptance records the provider ID and acceptance timestamp and adds a `registration-email-sent`
member snapshot. A failed attempt sets the email to `retrying`; the fourth failed attempt sets it to
`failure` and adds `registration-failed` with reason `email-sending-failed` and the provider error text.
Role edits are preserved; subsequent cancellation, blocking, registration, re-add, and community
archival prevent the job from overwriting the current member lifecycle.

Retries reuse `registration-email/<uuid>` as the idempotency key, where the UUID is the email's
immutable `carmbo_email_id` tag. Local job IDs restart in every database sharing a Resend account, so
they would collide across environments. Known local acceptance is never resent.
Resend retains keys for 24 hours, so an unknown acceptance retried after that window can send a duplicate.
Retry execution uses existing job triggers, not a new scheduler or backoff policy.

### Delivery callbacks

Signed Resend callbacks update only the email record, never the membership:

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

- `/emails` lists all emails, including unlinked ones, by creation time descending, then email number
  descending. Search matches recipient address, current community name, or current student name;
  SQL wildcard characters are literal. Paging uses 50-row HTMX infinite scrolling.
- Each row links to `/emails/:number`, showing purpose, recipient, optional community/member links,
  creation/acceptance/delivery times, all retry/send timestamps, status, and diagnostic text.
  Detail also shows the saved sender, subject, language, job/provider IDs, tags, HTML and plain text.
- HTML previews use a sandboxed iframe with scripts disabled and a content security policy blocking
  remote resources, including tracking images. `/emails/:number/html` serves the original source as
  plain text with `nosniff`, never executable application-origin HTML.
- `delivered` means API acceptance and `success` means provider-confirmed delivery. The UI labels
  make that distinction explicit. Both English and Hebrew/RTL are supported.
- The member association is resolved through `community_member.registration_email_number`, not a
  member reference on the email or a history snapshot. Unlinked emails remain fully viewable.

The host can create a real email service or a fake independently of the pages:

```ts
import {createResendEmailService} from '@giltayar/carmbo-pages-community/email/service'
import {createFakeEmailService} from '@giltayar/carmbo-pages-community/testkit/email-service'

const service = await createResendEmailService({apiKey, webhookUrl})
const fake = createFakeEmailService()

const message = {
  from: 'Carmbo <sender@your-verified-domain.example>',
  to: 'delivered@resend.dev',
  subject: 'Registration',
  html: '<p>Hello Student, welcome to Community.</p>',
  text: 'Hello Student, welcome to Community.',
  tags: {email_number: '123'},
}
const result = await service.sendEmail(message, {idempotencyKey: 'sendEmail/42'})
```

Messages and send options use plain TypeScript types, with no runtime request validation or
normalization in either the real service or the fake. Resend validates requests on the provider side.
The service uses the Resend SDK, preserves the idempotency key and tags, and
returns `{id}` on API acceptance. It performs no automatic retries or database writes. Provider
errors throw `EmailSendingError` with `code`, `statusCode` (nullable for transport errors), and the
provider's message. The job rejects a missing provider ID. `apiUrl` can override the endpoint for local
adapter tests. Callers must store the complete payload and reuse it unchanged on retries.

The fake has the same `sendEmail` interface, observable `attempts` and `sentEmails` snapshots, and
`failNextSend(error, {afterAcceptance: true})` for simulating a lost response after acceptance.
Without that option, the failure happens before acceptance. Inject `nowService` to test expiry.
Reusing a key with identical content returns the original ID for 24 hours; changed content rejects.
After 24 hours, a new send can occur, matching Resend's idempotency limitation.

Public types are `EmailService`, `ResendEmailService`, `EmailMessage`, `EmailSendOptions`,
`EmailSendResult`, and `FakeEmailService`. The fake has no webhook or `dispose`. Email page models are
exported from `@giltayar/carmbo-pages-community/testkit/page-model/email.model`.

### Standalone app

`pnpm start` loads the gitignored `.env.local`, respecting existing environment-variable precedence.
Set `RESEND_API_KEY` and `RESEND_FROM`; the existing `RESEND_TEST_API_KEY` and `RESEND_TEST_FROM`
are also accepted as fallbacks. Missing configuration fails at startup; no fake is substituted.
The standalone host sends real emails when members are added. Resend's test sender may only send
to your account's authorized recipient; use a verified sender/domain for other recipients, or add
members with Resend's `delivered+<label>@resend.dev` / `bounced+<label>@resend.dev` test addresses.

To receive delivery callbacks locally, startup opens a [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/)
quick tunnel (`brew install cloudflared`; no account needed; see
[cloudflared-tunnel.ts](./start/cloudflared-tunnel.ts)) and passes its public webhook URL to
`createResendEmailService`, which registers the temporary Resend webhook. The API key therefore needs
full access, not sending-only. Startup waits until the callback URL is reachable through the tunnel,
and Ctrl+C closes the app, disposes the email service (deleting the webhook), and stops the tunnel.
If the process is killed without cleanup, delete the stale `*.trycloudflare.com` webhook in the
Resend dashboard. Each `node --watch` restart opens a new tunnel.

The host mounts `/jobs` and the existing localhost job trigger endpoint at
`POST /api/jobs/trigger-job-execution?secret=...`. Set `JOB_API_SECRET` to protect this endpoint.
Startup and member additions also trigger execution. A current member page may need reloading
to show the completed job's status; automatic polling remains deferred.

### Real Resend E2E

`pnpm test:e2e` runs one real-provider Playwright test of the community happy path through the UI.
For local configuration:

```sh
cp .env.example .env.local
```

Replace the placeholder key in `.env.local` with your real Resend key. The E2E configuration loads
this gitignored file automatically, without overriding existing environment variables.
Configure
`RESEND_TEST_API_KEY` and `RESEND_TEST_FROM` (a verified sender); `RESEND_API_KEY` and `RESEND_FROM`
are accepted alternatives. The API key needs full access (it creates and deletes a temporary webhook),
and `cloudflared` must be installed. Missing configuration fails explicitly. Do not commit credentials.

The test starts its own PostgreSQL container, the standalone app, a cloudflared tunnel, and a temporary
Resend webhook. In the browser it creates a community, creates a student with a unique
`delivered+<run-id>@resend.dev` address, and adds them as a member. It then waits for the member page
to show "Registration email sent" and the email page to show "Delivery confirmed", which requires a
real, signed Resend callback through the tunnel. Cleanup deletes the webhook and stops the tunnel.
The special recipient simulates delivery; it is not a readable inbox, and it still consumes Resend
quota. The package's `pnpm test` also includes this E2E through its `test:*` scripts, so it requires
this configuration too. The other tests use local simulated Resend responses, the fake, and locally
signed callbacks, with no external requests.

## Verification

Run `pnpm build` before `pnpm test`. Tests include unit validation/mapping/transition checks,
compiled-export checks, and PostgreSQL-backed Playwright membership and community regressions.
Member-page tests perform actions and inspect membership state/history through page models, including
concurrent browser tabs for stale edits. Database access is limited to fixture setup and seeding
requested/timeout registration states that have no UI producer yet.
Email tests cover the adapter/fake, stored-model mapping, public exports, PostgreSQL queries,
search/paging/order, status metadata, safe previews/source, errors, and English/Hebrew pages.
Run `pnpm test:playwright email` for focused email-page coverage.
Registration tests also cover UI sending, immutable payloads, atomic rollback, intermediate retries,
four-attempt exhaustion and last-attempt success, lost responses, database failure after acceptance,
acceptance reconciliation, concurrent triggers, member action/role races, and standalone restart.
Sending tests assert visible state through the email, member, and job pages. Direct SQL is reserved
for fixtures and storage-only invariants: orphan snapshots and transaction lock availability.
Callback tests (`email/webhook.test.ts`) post locally signed events and cover delivery and each
failure type, unchanged memberships, duplicates and out-of-order events, invalid signatures and
payloads, unrelated/unsupported events, and callbacks racing a lost or failing API response.
Docker and an installed Playwright Chromium browser are required. For focused membership coverage:

```bash
pnpm test:playwright community/members.test.ts community/member.test.ts community/student-dialog.test.ts
```

Only the user publishes. Once this package is validated, publish it separately before updating any
application to consume its exact published version; there is no workspace linking.

## Local start

Start the package's PostgreSQL service and local Fastify host:

```bash
pnpm start
```

Open <http://127.0.0.1:3000/communities>. Data persists until the Docker Compose service is removed.
The start lifecycle refreshes Bootstrap and HTMX assets under `start/dist` before serving them.

Stop and remove the local PostgreSQL service:

```bash
pnpm stop
```

Use `LANGUAGE=he pnpm start` for Hebrew/Liraz rendering. The Fastify and PostgreSQL ports are fixed
at `3000` and `5435`, respectively.
