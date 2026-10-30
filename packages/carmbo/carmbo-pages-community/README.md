# `@giltayar/carmbo-pages-community`

Community pages for Carmbo applications: a searchable, paged community list and pages to create,
update, archive, restore, and view the history of a community.
Each community also has a separate Members tab/page with a paged membership list, a student picker/create flow, and dedicated
membership role/lifecycle/history pages.

## Usage

The host must initialize i18next, the app version, and the UI configuration, register
`@fastify/formbody`, `@fastify/request-context`, the Zod validator/serializer compilers, and run
the `@giltayar/carmbo-commons@2.3.0` migrations (including the membership schema). Then mount the routes:

```ts
import {routes as communityRoutes} from '@giltayar/carmbo-pages-community/routes'

app.register(communityRoutes, {prefix: '/communities', sql, nowService: () => new Date()})
```

Optionally pass `smooveIntegration` and `ravmesserIntegration` to use the host's configured student
contact integrations when creating students. These options are backwards-compatible and do not send
community registration emails. Mount the published student routes at `/students` to support the
student-profile links; the standalone host already does this.
This package uses student pages `1.1.0`, which shares commons `2.3.0`. Hosts mounting both page
packages must use the same commons runtime instance for version, UI configuration, and test hooks.
When mounting the student routes, parse nested URL-encoded form fields (for example with
`qs.parse`); the standalone host and integration fixtures do this.

Call `setUiConfiguration(name, {withCommunities: true})` to show the Communities navigation item.
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

**Deferred:** registration-email actions/delivery, automatic timeout processing, public/self-service
registration endpoints, and community permission enforcement. Future integrations may produce the
request/email/failure states; this step models and renders them but adds no such producer. The planned
timeout is seven days after sending the registration email, not after adding a student.

## Verification

Run `pnpm build` before `pnpm test`. Tests include unit validation/mapping/transition checks,
compiled-export checks, and PostgreSQL-backed Playwright membership and community regressions.
Member-page tests perform actions and inspect membership state/history through page models, including
concurrent browser tabs for stale edits. Database access is limited to fixture setup and seeding
future-produced registration states that have no UI producer yet.
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
