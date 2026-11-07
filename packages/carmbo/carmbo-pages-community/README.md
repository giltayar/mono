# `@giltayar/carmbo-pages-community`

Community pages for Carmbo applications: a searchable, paged community list and pages to create,
update, archive, restore, and view the history of a community.
Each community also has a separate Members tab/page with a paged membership list, a student picker/create flow, and dedicated
membership role/lifecycle/history pages.

## Usage

The host must initialize i18next, the app version, and the UI configuration, register
`@fastify/formbody`, `@fastify/request-context`, the Zod validator/serializer compilers, and run
the `@giltayar/carmbo-commons@2.4.0` migrations (including membership and email schemas). Then mount the routes:

```ts
import {routes as communityRoutes} from '@giltayar/carmbo-pages-community/routes'
import {routes as emailRoutes} from '@giltayar/carmbo-pages-community/email/routes'

app.register(communityRoutes, {prefix: '/communities', sql, nowService: () => new Date()})
app.register(emailRoutes, {prefix: '/emails', sql})
```

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
  registration, refreshes the entry date/order, and clears the previous attempt's diagnostics and
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

**Deferred:** member-triggered registration-email jobs and delivery callbacks, automatic timeout processing, public/self-service
registration endpoints, and community permission enforcement. Future integrations may produce the
request/email/failure states; this step models and renders them but adds no such producer. The planned
timeout is seven days after sending the registration email, not after adding a student.

## Emails

Email code lives under `src/email`, separate from the community route/controller/view/model.
The email pages are read-only and show existing database records. This stage does not create email
jobs, send on member addition, update member status, receive webhooks, or poll member pages.
Registration templates, application integration, and the direct-to-registered re-add change remain
for the next stage.

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

const service = createResendEmailService({apiKey})
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
provider's message; malformed responses also reject. `apiUrl` can override the endpoint for local
adapter tests. Callers must store the complete payload and reuse it unchanged on retries.

The fake has the same `sendEmail` interface, observable `attempts` and `sentEmails` snapshots, and
`failNextSend(error, {afterAcceptance: true})` for simulating a lost response after acceptance.
Without that option, the failure happens before acceptance. Inject `nowService` to test expiry.
Reusing a key with identical content returns the original ID for 24 hours; changed content rejects.
After 24 hours, a new send can occur, matching Resend's idempotency limitation.

Public types are `EmailService`, `EmailMessage`, `EmailSendOptions`, `EmailSendResult`,
and `FakeEmailService`. Email page models are exported from
`@giltayar/carmbo-pages-community/testkit/page-model/email.model`.

### Real Resend E2E

`pnpm test:e2e` runs the real-provider Playwright test without launching a browser. For local configuration:

```sh
cp .env.example .env.local
```

Replace the placeholder key in `.env.local` with your real Resend key. The E2E configuration loads
this gitignored file automatically, without overriding existing environment variables.
Configure
`RESEND_TEST_API_KEY` and `RESEND_TEST_FROM` (a verified sender); `RESEND_API_KEY` and `RESEND_FROM`
are accepted alternatives. The API key must allow both sending and retrieving emails (full access,
not sending-only). Missing configuration fails explicitly. Do not commit credentials.

The test sends to a unique `delivered+<run-id>@resend.dev` address and repeats the identical request
with the same key, asserting the same provider ID. It then polls the sent-email API for up to
20 seconds until `last_event` is `delivered`. This confirms Resend's simulated delivery, not receipt
in a readable inbox, delivery webhooks, or member registration. These special recipients are safe
test destinations but still consume Resend quota. The package's `pnpm test` also includes this E2E
through its `test:*` scripts, so it requires Resend configuration too. The other tests use local
simulated Resend responses and the fake, with no external email requests.

## Verification

Run `pnpm build` before `pnpm test`. Tests include unit validation/mapping/transition checks,
compiled-export checks, and PostgreSQL-backed Playwright membership and community regressions.
Member-page tests perform actions and inspect membership state/history through page models, including
concurrent browser tabs for stale edits. Database access is limited to fixture setup and seeding
future-produced registration states that have no UI producer yet.
Email tests cover the adapter/fake, stored-model mapping, public exports, PostgreSQL queries,
search/paging/order, status metadata, safe previews/source, errors, and English/Hebrew pages.
Run `pnpm test:playwright email` for focused email-page coverage.
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
